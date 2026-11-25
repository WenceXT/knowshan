import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

function sdTaperedCapsule(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  rA: number,
  rB: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const ab2 = abx * abx + aby * aby + abz * abz;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / ab2));
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  const dz = apz - abz * t;
  const r = rA + (rB - rA) * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

function sdSphere(
  px: number,
  py: number,
  pz: number,
  cx: number,
  cy: number,
  cz: number,
  r: number
): number {
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

/**
 * Cute Q-Version Cartoon Blind-Box Liu Kanshan SDF:
 * - Chubby rounded mochi-pear body (no skinny neck, soft wide cheeks)
 * - Short, plump, adorable fox muzzle (no long anteater tube!)
 * - Plump, soft-tipped rounded fox ears
 * - Fluffy round tail nestled snugly on lower back
 */
export function evalCartoonKanshanSDF(x: number, y: number, z: number): number {
  // 1. Plump rounded mochi-pear torso & head
  const dTorsoRaw = sdTaperedCapsule(
    x * 0.88,
    y,
    z * 0.94,
    0,
    -0.21,
    0.0,
    0,
    0.15,
    -0.01,
    0.405,
    0.342
  );
  // Softly cushion the underside of the tummy
  const dTorso = smax(dTorsoRaw, -(y + 0.565), 0.11);

  // 2. Plump, thick, rounded cartoon fox ears (wider base, rounder tip, slight outward tilt)
  const ax = Math.abs(x);
  const dEar = sdTaperedCapsule(
    ax,
    y,
    (z + 0.02) * 1.15,
    0.165,
    0.26,
    0,
    0.205,
    0.545,
    0,
    0.152,
    0.066
  );
  const dHeadEars = smin(dTorso, dEar, 0.068);

  // 3. Cute SHORT plump muzzle (protrudes gently like a plush toy, never a long pipe!)
  const dMuzzle = sdTaperedCapsule(
    x * 0.80,
    (y - 0.21) * 1.08 + 0.21,
    z,
    0,
    0.195,
    0.08,
    0,
    0.215,
    0.395,
    0.215,
    0.135
  );

  return smin(dHeadEars, dMuzzle, 0.115);
}

// Find exact radial surface point at height y and angle theta (0 = +Z front, PI/2 = +X right)
export function findBodyRadiusAtAngle(y: number, theta: number): number {
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  let lo = 0.0;
  let hi = 0.85;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5;
    if (evalCartoonKanshanSDF(mid * sinT, y, mid * cosT) < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) * 0.5;
}

export function findSurfaceX(y: number, z: number): number {
  let lo = 0.0;
  let hi = 0.85;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5;
    if (evalCartoonKanshanSDF(mid, y, z) < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) * 0.5;
}

export function buildSmoothSDFMesh(
  resolution: number,
  material: THREE.Material,
  sdfFn: (x: number, y: number, z: number) => number
): THREE.Mesh {
  const mc = new MarchingCubes(resolution, material, false, false, 180000);
  mc.isolation = 0.0;
  mc.reset();

  const size = mc.size;
  const size2 = size * size;
  const half = size / 2;
  const field = mc.field;

  for (let z = 1; z < size - 1; z++) {
    const fz = (z - half) / half;
    const zOff = z * size2;
    for (let y = 1; y < size - 1; y++) {
      const fy = (y - half) / half;
      const yOff = zOff + y * size;
      for (let x = 1; x < size - 1; x++) {
        const fx = (x - half) / half;
        field[yOff + x] = -sdfFn(fx, fy, fz);
      }
    }
  }

  mc.update();

  // Bake exact analytical SDF gradient normals at every vertex for 100% silky blind-box shading!
  const vCount = mc.count;
  const posOut = new Float32Array(vCount * 3);
  const normOut = new Float32Array(vCount * 3);
  const srcPos = mc.positionArray;
  const eps = 0.004;

  for (let i = 0; i < vCount; i++) {
    const i3 = i * 3;
    const vx = srcPos[i3];
    const vy = srcPos[i3 + 1];
    const vz = srcPos[i3 + 2];
    posOut[i3] = vx;
    posOut[i3 + 1] = vy;
    posOut[i3 + 2] = vz;

    const gx = sdfFn(vx + eps, vy, vz) - sdfFn(vx - eps, vy, vz);
    const gy = sdfFn(vx, vy + eps, vz) - sdfFn(vx, vy - eps, vz);
    const gz = sdfFn(vx, vy, vz + eps) - sdfFn(vx, vy, vz - eps);
    const len = Math.hypot(gx, gy, gz) || 1;
    normOut[i3] = gx / len;
    normOut[i3 + 1] = gy / len;
    normOut[i3 + 2] = gz / len;
  }

  const bakedGeo = new THREE.BufferGeometry();
  bakedGeo.setAttribute("position", new THREE.BufferAttribute(posOut, 3));
  bakedGeo.setAttribute("normal", new THREE.BufferAttribute(normOut, 3));
  bakedGeo.computeBoundingSphere();
  mc.geometry.dispose();

  return new THREE.Mesh(bakedGeo, material);
}

/**
 * Procedural Knitted Wool Texture (Color + Bump) so scarf & beanie look like cozy yarn!
 */
export function createKnittedTextures(
  primaryHex: string,
  stripeHex: string
): { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } {
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = 256;
  colorCanvas.height = 256;
  const cctx = colorCanvas.getContext("2d")!;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext("2d")!;

  cctx.fillStyle = primaryHex;
  cctx.fillRect(0, 0, 256, 256);

  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, 256, 256);

  // Woven V-stitch knit ribs
  for (let x = 0; x < 256; x += 16) {
    cctx.fillStyle = "rgba(255,255,255,0.08)";
    cctx.fillRect(x, 0, 7, 256);
    cctx.fillStyle = "rgba(0,0,0,0.07)";
    cctx.fillRect(x + 8, 0, 4, 256);

    for (let y = 0; y < 256; y += 12) {
      bctx.strokeStyle = "#d8d8d8";
      bctx.lineWidth = 3.5;
      bctx.beginPath();
      bctx.moveTo(x + 2, y + 8);
      bctx.lineTo(x + 8, y + 2);
      bctx.lineTo(x + 14, y + 8);
      bctx.stroke();

      bctx.strokeStyle = "#404040";
      bctx.lineWidth = 1.5;
      bctx.beginPath();
      bctx.moveTo(x + 8, y + 2);
      bctx.lineTo(x + 8, y + 11);
      bctx.stroke();
    }
  }

  // Subtle decorative winter stripe near border
  cctx.fillStyle = stripeHex;
  cctx.fillRect(0, 212, 256, 14);
  cctx.fillRect(0, 234, 256, 6);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 2);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(6, 2);

  return { map, bumpMap };
}

/**
 * Builds a Designer-Toy Contoured Double-Coil Knitted Scarf that HUGS the body with zero air gap!
 */
export function buildContouredKnittedScarf(S: number): THREE.Group {
  const group = new THREE.Group();
  const { map, bumpMap } = createKnittedTextures("#3b82f6", "#dbeafe");

  const woolMat = new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.018,
    roughness: 0.88,
    metalness: 0.0,
  });
  const fringeMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.92,
  });

  // 1. Upper & Lower Snug Neck Coils contoured directly onto `findBodyRadiusAtAngle`!
  const makeCoilCurve = (baseY: number, radiusOffset: number, frontDip: number, twistWave: number) => {
    const pts: THREE.Vector3[] = [];
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const theta = (i / steps) * Math.PI * 2;
      const dip = Math.max(0, Math.cos(theta)) * frontDip;
      const y = baseY - dip + Math.sin(theta * 3) * twistWave;
      const surfR = findBodyRadiusAtAngle(y, theta);
      const r = (surfR + radiusOffset) * S;
      pts.push(new THREE.Vector3(Math.sin(theta) * r, y * S, Math.cos(theta) * r));
    }
    return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
  };

  // Lower cozy wrap coil (embedded -0.014 into plush skin so ZERO air gap at any angle!)
  const lowerCoil = new THREE.Mesh(
    new THREE.TubeGeometry(makeCoilCurve(-0.03, -0.014, 0.04, 0.006), 72, 0.068, 18, true),
    woolMat
  );
  lowerCoil.castShadow = true;
  group.add(lowerCoil);

  // Upper overlapping cozy wrap coil
  const upperCoil = new THREE.Mesh(
    new THREE.TubeGeometry(makeCoilCurve(0.025, -0.010, 0.032, -0.005), 72, 0.064, 18, true),
    woolMat
  );
  upperCoil.castShadow = true;
  group.add(upperCoil);

  // 2. Plump Cozy Knot Puff at Front-Right Collar!
  const knotAngle = 0.38;
  const knotY = -0.055;
  const knotR = (findBodyRadiusAtAngle(knotY, knotAngle) + 0.018) * S;
  const knotMesh = new THREE.Mesh(new THREE.SphereGeometry(0.098, 20, 20), woolMat);
  knotMesh.scale.set(1.18, 0.92, 0.88);
  knotMesh.position.set(Math.sin(knotAngle) * knotR, knotY * S, Math.cos(knotAngle) * knotR);
  knotMesh.rotation.y = knotAngle;
  knotMesh.castShadow = true;
  group.add(knotMesh);

  // 3. Soft Contoured Draped Scarf Tail + Cute Yarn Fringe Tassels!
  const buildDrapedTail = (
    startAngle: number,
    endAngle: number,
    startY: number,
    endY: number,
    protrude: number,
    widthScale: number
  ) => {
    const tailGroup = new THREE.Group();
    const curvePts: THREE.Vector3[] = [];
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const ang = startAngle + (endAngle - startAngle) * t;
      const y = startY + (endY - startY) * t;
      const r = (findBodyRadiusAtAngle(y, ang) + protrude + Math.sin(t * Math.PI) * 0.015) * S;
      curvePts.push(new THREE.Vector3(Math.sin(ang) * r, y * S, Math.cos(ang) * r));
    }
    const tailCurve = new THREE.CatmullRomCurve3(curvePts);

    // Build a soft rounded-plank ribbon along the curve by placing overlapping smooth capsules/segments
    // or extruded rounded rectangle shape! ExtrudeGeometry along CatmullRomCurve3 gives a true woven flat scarf tail!
    const w = 0.082 * widthScale;
    const th = 0.024;
    const rectShape = new THREE.Shape();
    rectShape.moveTo(-w, -th);
    rectShape.quadraticCurveTo(0, -th * 1.3, w, -th);
    rectShape.quadraticCurveTo(w * 1.15, 0, w, th);
    rectShape.quadraticCurveTo(0, th * 1.3, -w, th);
    rectShape.quadraticCurveTo(-w * 1.15, 0, -w, -th);

    const extrudeGeo = new THREE.ExtrudeGeometry(rectShape, {
      steps: 28,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 4,
      extrudePath: tailCurve,
    });
    const ribbonMesh = new THREE.Mesh(extrudeGeo, woolMat);
    ribbonMesh.castShadow = true;
    tailGroup.add(ribbonMesh);

    // 4 Cute Little Yarn Tassels hanging from the bottom tip of the scarf tail!
    const endPt = curvePts[curvePts.length - 1];
    for (let f = -1.5; f <= 1.5; f += 1) {
      const tassel = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.014, 0.042, 8, 10),
        fringeMat
      );
      const offsetAngle = endAngle + f * 0.055;
      const tr = (findBodyRadiusAtAngle(endY, offsetAngle) + protrude) * S;
      tassel.position.set(
        Math.sin(offsetAngle) * tr,
        endPt.y - 0.036,
        Math.cos(offsetAngle) * tr
      );
      tassel.rotation.z = -offsetAngle * 0.25;
      tailGroup.add(tassel);
    }

    return tailGroup;
  };

  // Longer front scarf tail & shorter under-layered tail hugging the belly contour!
  group.add(buildDrapedTail(0.36, 0.44, -0.07, -0.34, 0.018, 1.0));
  group.add(buildDrapedTail(0.50, 0.62, -0.07, -0.25, 0.008, 0.88));

  return group;
}

/**
 * Builds Sleek Beveled 3D Eyeglasses with Translucent Lenses & Temple Arms!
 */
export function buildDetailedGlasses(S: number, eyeY: number, eyeZ: number, eyeSurfX: number): THREE.Group {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x222733,
    roughness: 0.28,
    metalness: 0.15,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.26,
    roughness: 0.1,
    metalness: 0.3,
  });

  // Rounded-square frame shape with inner lens cutout
  const makeRoundedRectPath = (hw: number, hh: number, r: number, isHole = false) => {
    const p = isHole ? new THREE.Path() : new THREE.Shape();
    p.moveTo(-hw + r, -hh);
    p.lineTo(hw - r, -hh);
    p.quadraticCurveTo(hw, -hh, hw, -hh + r);
    p.lineTo(hw, hh - r);
    p.quadraticCurveTo(hw, hh, hw - r, hh);
    p.lineTo(-hw + r, hh);
    p.quadraticCurveTo(-hw, hh, -hw, hh - r);
    p.lineTo(-hw, -hh + r);
    p.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
    return p;
  };

  const outer = makeRoundedRectPath(0.145, 0.115, 0.045, false) as THREE.Shape;
  const inner = makeRoundedRectPath(0.112, 0.084, 0.032, true);
  outer.holes.push(inner);

  const rimGeo = new THREE.ExtrudeGeometry(outer, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 4,
  });

  const lensShape = makeRoundedRectPath(0.114, 0.086, 0.032, false) as THREE.Shape;
  const lensGeo = new THREE.ShapeGeometry(lensShape);

  [-1, 1].forEach((side) => {
    const frameGroup = new THREE.Group();
    const rim = new THREE.Mesh(rimGeo, frameMat);
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.z = 0.009;
    frameGroup.add(rim, lens);

    frameGroup.position.set(
      side * (eyeSurfX + 0.015) * S,
      eyeY * S,
      (eyeZ + 0.065) * S
    );
    frameGroup.rotation.y = side * 0.34;
    group.add(frameGroup);

    // Temple arm going back gently along the side of the head!
    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * (eyeSurfX + 0.09) * S, (eyeY + 0.02) * S, (eyeZ + 0.01) * S),
      new THREE.Vector3(side * (eyeSurfX + 0.085) * S, (eyeY + 0.025) * S, -0.05 * S),
      new THREE.Vector3(side * (eyeSurfX + 0.06) * S, (eyeY - 0.02) * S, -0.14 * S),
    ]);
    const temple = new THREE.Mesh(
      new THREE.TubeGeometry(templeCurve, 16, 0.014, 10, false),
      frameMat
    );
    group.add(temple);
  });

  // Curved bridge resting neatly above the snout!
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.14 * S, (eyeY + 0.01) * S, (eyeZ + 0.095) * S),
    new THREE.Vector3(0, (eyeY + 0.055) * S, (eyeZ + 0.125) * S),
    new THREE.Vector3(0.14 * S, (eyeY + 0.01) * S, (eyeZ + 0.095) * S),
  ]);
  const bridge = new THREE.Mesh(
    new THREE.TubeGeometry(bridgeCurve, 18, 0.016, 12, false),
    frameMat
  );
  group.add(bridge);

  return group;
}

/**
 * Builds a Ribbed Knitted Winter Beanie sitting snugly between/on top of crown!
 */
export function buildKnittedBeanie(S: number): THREE.Group {
  const group = new THREE.Group();
  const { map, bumpMap } = createKnittedTextures("#293548", "#fbbf24");
  const hatMat = new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.016,
    roughness: 0.9,
  });
  const cuffMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    bumpMap,
    bumpScale: 0.02,
    roughness: 0.88,
  });
  const pomMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    roughness: 0.95,
  });

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.24 * S, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hatMat
  );
  dome.position.set(0, 0.43 * S, -0.01 * S);
  dome.castShadow = true;

  // Plump rolled ribbed cuff
  const cuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.23 * S, 0.048 * S, 16, 36),
    cuffMat
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.scale.set(1.04, 1, 0.85);
  cuff.position.set(0, 0.45 * S, -0.01 * S);

  // Fluffy multi-tuft pom-pom
  const pomGroup = new THREE.Group();
  pomGroup.position.set(0, 0.69 * S, -0.01 * S);
  pomGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.068 * S, 16, 16), pomMat));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.036 * S, 10, 10), pomMat);
    tuft.position.set(Math.cos(a) * 0.042 * S, Math.sin(a * 2) * 0.02 * S, Math.sin(a) * 0.042 * S);
    pomGroup.add(tuft);
  }

  group.add(dome, cuff, pomGroup);
  return group;
}

/**
 * Builds Cute Detailed Plush Earmuffs with Fleece Cushions & Headband!
 */
export function buildPlushEarmuffs(S: number): THREE.Group {
  const group = new THREE.Group();
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.45 });
  const pinkPlush = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.92 });
  const whiteFleece = new THREE.MeshStandardMaterial({ color: 0xfffdf9, roughness: 0.96 });

  const bandCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.34 * S, 0.34 * S, -0.01 * S),
    new THREE.Vector3(-0.24 * S, 0.50 * S, -0.01 * S),
    new THREE.Vector3(0, 0.54 * S, -0.01 * S),
    new THREE.Vector3(0.24 * S, 0.50 * S, -0.01 * S),
    new THREE.Vector3(0.34 * S, 0.34 * S, -0.01 * S),
  ]);
  const band = new THREE.Mesh(new THREE.TubeGeometry(bandCurve, 28, 0.022, 12, false), bandMat);
  group.add(band);

  [-1, 1].forEach((side) => {
    const cup = new THREE.Group();
    const cushion = new THREE.Mesh(new THREE.TorusGeometry(0.075 * S, 0.038 * S, 14, 24), whiteFleece);
    cushion.rotation.y = Math.PI / 2;
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.095 * S, 20, 20), pinkPlush);
    outer.scale.set(0.58, 1, 1);
    outer.position.x = side * 0.022 * S;
    cup.add(cushion, outer);
    cup.position.set(side * 0.34 * S, 0.33 * S, -0.01 * S);
    cup.rotation.z = -side * 0.18;
    group.add(cup);
  });

  return group;
}

/**
 * Builds a Cute Detailed Plush Silver Codfish Toy!
 */
export function buildCuteCodfish(): THREE.Group {
  const g = new THREE.Group();
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.55 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.65 });
  const eyeDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 22, 18), blueMat);
  body.scale.set(1.65, 0.88, 0.65);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.098, 18, 16), bellyMat);
  belly.scale.set(1.5, 0.72, 0.68);
  belly.position.y = -0.022;

  // Cute heart-lobed tail fin
  const tailTop = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), blueMat);
  tailTop.scale.set(1.3, 0.65, 0.35);
  tailTop.position.set(0.20, 0.035, 0);
  tailTop.rotation.z = 0.45;

  const tailBot = tailTop.clone();
  tailBot.position.set(0.20, -0.035, 0);
  tailBot.rotation.z = -0.45;

  const dorsal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), blueMat);
  dorsal.scale.set(1.4, 0.6, 0.3);
  dorsal.position.set(0.02, 0.09, 0);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), eyeDark);
  eyeL.position.set(-0.10, 0.02, 0.058);
  const eyeR = eyeL.clone();
  eyeR.position.z = -0.058;

  g.add(body, belly, tailTop, tailBot, dorsal, eyeL, eyeR);
  return g;
}
