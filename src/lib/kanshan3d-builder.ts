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

// Find exact front surface Z at a given (x, y) on the face so glasses wrap organically with zero floating corners!
export function findFaceSurfaceZ(x: number, y: number): number {
  let lo = 0.0;
  let hi = 0.75;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5;
    if (evalCartoonKanshanSDF(x, y, mid) < 0) {
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
 * Builds Face-Wrapped Designer-Toy Cartoon Eyeglasses (matching reference screenshot!):
 * - Contoured 3D rounded-trapezoid dark-slate frames wrapped smoothly onto `findFaceSurfaceZ(x, y)`
 * - Saddle arch bridge sitting snugly right over the top curve of the snout
 * - Curved glossy cartoon lenses with cute diagonal white anime glint reflection
 * - Flush temple arms hugging the sides of the head
 */
export function buildDetailedGlasses(
  S: number,
  eyeY: number,
  _eyeZ: number,
  _eyeSurfX: number
): THREE.Group {
  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x262e3d,
    roughness: 0.32,
    metalness: 0.12,
  });

  // Crisp cartoon lens texture with subtle sky tint + diagonal white anime reflection glint!
  const lensCanvas = document.createElement("canvas");
  lensCanvas.width = 128;
  lensCanvas.height = 128;
  const lctx = lensCanvas.getContext("2d")!;
  lctx.fillStyle = "rgba(219, 238, 255, 0.22)";
  lctx.fillRect(0, 0, 128, 128);
  lctx.strokeStyle = "rgba(255, 255, 255, 0.62)";
  lctx.lineWidth = 14;
  lctx.lineCap = "round";
  lctx.beginPath();
  lctx.moveTo(26, 96);
  lctx.lineTo(86, 26);
  lctx.stroke();
  lctx.lineWidth = 6;
  lctx.beginPath();
  lctx.moveTo(54, 102);
  lctx.lineTo(102, 46);
  lctx.stroke();
  const lensTex = new THREE.CanvasTexture(lensCanvas);
  lensTex.colorSpace = THREE.SRGBColorSpace;

  const lensMat = new THREE.MeshStandardMaterial({
    map: lensTex,
    transparent: true,
    opacity: 0.85,
    roughness: 0.12,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Smooth optical eyewear arc guaranteed >= faceSurface + 0.032 clearance so rims & bridge NEVER clip into snout!
  const eyewearZ = (x: number, y: number) => {
    const opticalArc = 0.446 - 1.18 * x * x;
    const minClear = findFaceSurfaceZ(x, y) + 0.032;
    return Math.max(opticalArc, minClear);
  };

  const sampleRoundedLensLoop = (
    cx: number,
    cy: number,
    hw: number,
    hh: number,
    side: number,
    steps: number
  ): THREE.Vector3[] => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const powCos = Math.sign(cosA) * Math.pow(Math.abs(cosA), 0.68);
      const powSin = Math.sign(sinA) * Math.pow(Math.abs(sinA), 0.68);
      const noseContour = sinA < 0 && side * cosA < 0 ? 0.88 : 1.0;
      const lx = cx + powCos * hw * noseContour;
      const ly = cy + powSin * hh;
      const wz = eyewearZ(lx, ly) * S;
      pts.push(new THREE.Vector3(lx * S, ly * S, wz));
    }
    return pts;
  };

  const centerX = 0.208;
  const centerY = eyeY + 0.004;
  const halfW = 0.078;
  const halfH = 0.064;

  [-1, 1].forEach((side) => {
    const cx = side * centerX;
    const loopPts = sampleRoundedLensLoop(cx, centerY, halfW, halfH, side, 44);
    const frameCurve = new THREE.CatmullRomCurve3(loopPts, true, "catmullrom", 0.5);
    const rimMesh = new THREE.Mesh(
      new THREE.TubeGeometry(frameCurve, 64, 0.017 * S, 16, true),
      frameMat
    );
    rimMesh.castShadow = true;
    group.add(rimMesh);

    // Smoothly curved lens inside the optical rim!
    const gridN = 8;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let iy = 0; iy <= gridN; iy++) {
      const v = iy / gridN;
      const ny = (v * 2 - 1) * 0.88;
      for (let ix = 0; ix <= gridN; ix++) {
        const u = ix / gridN;
        const nx = (u * 2 - 1) * 0.88;
        const rLen = Math.pow(Math.abs(nx), 3.0) + Math.pow(Math.abs(ny), 3.0);
        const scaleBack = rLen > 1 ? 1 / Math.pow(rLen, 1 / 3.0) : 1.0;
        const noseContour = ny < 0 && side * nx < 0 ? 0.88 : 1.0;
        const px = cx + nx * scaleBack * halfW * noseContour;
        const py = centerY + ny * scaleBack * halfH;
        const pz = eyewearZ(px, py) - 0.004;
        positions.push(px * S, py * S, pz * S);
        uvs.push(u, v);
      }
    }
    for (let iy = 0; iy < gridN; iy++) {
      for (let ix = 0; ix < gridN; ix++) {
        const a = iy * (gridN + 1) + ix;
        const b = a + 1;
        const c = a + (gridN + 1);
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
    const curvedLensGeo = new THREE.BufferGeometry();
    curvedLensGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    curvedLensGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    curvedLensGeo.setIndex(indices);
    curvedLensGeo.computeVertexNormals();
    group.add(new THREE.Mesh(curvedLensGeo, lensMat));

    // Outer Corner Hinge Lug + Temple Arm tucking neatly into the side of the head!
    const outerX = side * (centerX + halfW * 0.98);
    const outerY = centerY + 0.012;
    const outerZ = eyewearZ(outerX, outerY);

    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.022 * S, 0.020 * S, 0.024 * S), frameMat);
    lug.position.set(outerX * S, outerY * S, outerZ * S);
    lug.rotation.y = side * 0.35;
    group.add(lug);

    const endSurfX = findSurfaceX(outerY - 0.01, 0.04);
    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(outerX * S, outerY * S, outerZ * S),
      new THREE.Vector3(side * (endSurfX + 0.008) * S, outerY * S, 0.16 * S),
      new THREE.Vector3(side * (endSurfX - 0.01) * S, (outerY - 0.012) * S, 0.02 * S),
    ]);
    const templeMesh = new THREE.Mesh(
      new THREE.TubeGeometry(templeCurve, 18, 0.013 * S, 12, false),
      frameMat
    );
    group.add(templeMesh);
  });

  // Smooth Saddle Arch Bridge resting visibly on top of the snout behind the black nose!
  const bridgePts: THREE.Vector3[] = [];
  const innerEdgeX = centerX - halfW * 0.94;
  for (let i = 0; i <= 14; i++) {
    const u = (i / 14) * 2 - 1;
    const bx = u * innerEdgeX;
    const archLift = (1 - u * u) * 0.032;
    const by = centerY + 0.016 + archLift;
    const bz = eyewearZ(bx, by) + (1 - u * u) * 0.008;
    bridgePts.push(new THREE.Vector3(bx * S, by * S, bz * S));
  }
  const bridgeCurve = new THREE.CatmullRomCurve3(bridgePts);
  const bridgeMesh = new THREE.Mesh(
    new THREE.TubeGeometry(bridgeCurve, 24, 0.016 * S, 14, false),
    frameMat
  );
  bridgeMesh.castShadow = true;
  group.add(bridgeMesh);

  return group;
}

/**
 * Builds a Ribbed Knitted Winter Beanie sitting snugly & jauntily between the ears!
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

  const sub = new THREE.Group();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.195 * S, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hatMat
  );
  dome.scale.set(1.05, 0.95, 1.05);

  const cuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.19 * S, 0.042 * S, 16, 36),
    cuffMat
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = 0.015 * S;

  const pomGroup = new THREE.Group();
  pomGroup.position.set(0, 0.21 * S, 0);
  pomGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.056 * S, 16, 16), pomMat));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.03 * S, 10, 10), pomMat);
    tuft.position.set(
      Math.cos(a) * 0.035 * S,
      Math.sin(a * 2) * 0.015 * S,
      Math.sin(a) * 0.035 * S
    );
    pomGroup.add(tuft);
  }

  sub.add(dome, cuff, pomGroup);
  sub.position.set(0, 0.395 * S, -0.025 * S);
  sub.rotation.x = -0.14; // Cute jaunty tilt slightly backward so it clears face & speech bubble!
  group.add(sub);
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
