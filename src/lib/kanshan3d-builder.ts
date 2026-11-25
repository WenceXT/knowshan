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
  return Math.hypot(dx, dy, dz) - r;
}

/**
 * Designer-Toy (JOYBRAIN × Zhihu Blind-Box / Cozy Sitting Plushie) Liu Kanshan SDF:
 * - 1:1 Chubby Marshmallow Cylinder-Mochi Body (wide cute cheeks & forehead, NEVER pointy egg!)
 * - Flat-cushioned sitting base resting squarely on the fluffy rug
 * - Wide-set, plump, soft-edged Arctic Fox ears framing a broad innocent forehead
 * - Subtle smooth snout mound blended seamlessly into the face
 */
export function evalCartoonKanshanSDF(x: number, y: number, z: number): number {
  // 1. Wide, huggable 1:1 marshmallow cylinder-pear body (rBottom=0.425, rTop=0.382 -> broad cute head!)
  const dBodyRaw = sdTaperedCapsule(
    x * 0.86,
    y,
    z * 0.94,
    0,
    -0.16,
    0.0,
    0,
    0.16,
    0.0,
    0.425,
    0.382
  );
  // Softly flatten sitting bottom at y = -0.48 so it sits plumply right on the rug!
  const dSittingBody = smax(dBodyRaw, -(y + 0.485), 0.115);

  // Also gently flatten the top forehead dome slightly so the brow between the ears is wide & cute!
  const dSoftCrown = smax(dSittingBody, y - 0.485, 0.085);

  // 2. Wide-set, plump, soft-tipped Arctic Fox ears (positioned wider apart at x = ±0.235!)
  const ax = Math.abs(x);
  const dEar = sdTaperedCapsule(
    ax,
    y,
    (z + 0.01) * 1.18,
    0.225,
    0.31,
    0,
    0.242,
    0.615,
    0,
    0.155,
    0.068
  );
  const dHeadEars = smin(dSoftCrown, dEar, 0.062);

  // 3. Short, plump, stream-lined fox muzzle mound (blends seamlessly into face)
  const dMuzzle = sdTaperedCapsule(
    x * 0.88,
    y,
    z,
    0,
    0.18,
    0.12,
    0,
    0.195,
    0.365,
    0.195,
    0.148
  );

  return smin(dHeadEars, dMuzzle, 0.105);
}

export function findBodyRadiusAtAngle(y: number, theta: number): number {
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  let lo = 0.0;
  let hi = 0.88;
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
  let hi = 0.88;
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

export function findFaceSurfaceZ(x: number, y: number): number {
  let lo = 0.0;
  let hi = 0.78;
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
  const mc = new MarchingCubes(resolution, material, false, false, 190000);
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
 * Procedural Knitted Wool Texture
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

  for (let x = 0; x < 256; x += 16) {
    cctx.fillStyle = "rgba(255,255,255,0.09)";
    cctx.fillRect(x, 0, 7, 256);
    cctx.fillStyle = "rgba(0,0,0,0.06)";
    cctx.fillRect(x + 8, 0, 4, 256);

    for (let y = 0; y < 256; y += 12) {
      bctx.strokeStyle = "#d8d8d8";
      bctx.lineWidth = 3.5;
      bctx.beginPath();
      bctx.moveTo(x + 2, y + 8);
      bctx.lineTo(x + 8, y + 2);
      bctx.lineTo(x + 14, y + 8);
      bctx.stroke();
    }
  }

  cctx.fillStyle = stripeHex;
  cctx.fillRect(0, 210, 256, 14);
  cctx.fillRect(0, 232, 256, 6);

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
 * Flush Contoured Double-Coil Knitted Scarf
 */
export function buildContouredKnittedScarf(S: number): THREE.Group {
  const group = new THREE.Group();
  const { map, bumpMap } = createKnittedTextures("#4a8df8", "#e0f2fe");

  const woolMat = new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: 0.016,
    roughness: 0.88,
    metalness: 0.0,
  });
  const fringeMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    roughness: 0.92,
  });

  const makeCoilCurve = (baseY: number, radiusOffset: number, frontDip: number, twistWave: number) => {
    const pts: THREE.Vector3[] = [];
    const steps = 44;
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

  const lowerCoil = new THREE.Mesh(
    new THREE.TubeGeometry(makeCoilCurve(-0.02, -0.015, 0.035, 0.005), 72, 0.045 * S, 18, true),
    woolMat
  );
  lowerCoil.castShadow = true;
  group.add(lowerCoil);

  const upperCoil = new THREE.Mesh(
    new THREE.TubeGeometry(makeCoilCurve(0.032, -0.012, 0.028, -0.004), 72, 0.042 * S, 18, true),
    woolMat
  );
  upperCoil.castShadow = true;
  group.add(upperCoil);

  const knotAngle = 0.36;
  const knotY = -0.045;
  const knotR = (findBodyRadiusAtAngle(knotY, knotAngle) + 0.016) * S;
  const knotMesh = new THREE.Mesh(new THREE.SphereGeometry(0.066 * S, 20, 20), woolMat);
  knotMesh.scale.set(1.18, 0.92, 0.88);
  knotMesh.position.set(Math.sin(knotAngle) * knotR, knotY * S, Math.cos(knotAngle) * knotR);
  knotMesh.rotation.y = knotAngle;
  knotMesh.castShadow = true;
  group.add(knotMesh);

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
      const r = (findBodyRadiusAtAngle(y, ang) + protrude + Math.sin(t * Math.PI) * 0.012) * S;
      curvePts.push(new THREE.Vector3(Math.sin(ang) * r, y * S, Math.cos(ang) * r));
    }
    const tailCurve = new THREE.CatmullRomCurve3(curvePts);

    const w = 0.054 * S * widthScale;
    const th = 0.016 * S;
    const rectShape = new THREE.Shape();
    rectShape.moveTo(-w, -th);
    rectShape.quadraticCurveTo(0, -th * 1.25, w, -th);
    rectShape.quadraticCurveTo(w * 1.12, 0, w, th);
    rectShape.quadraticCurveTo(0, th * 1.25, -w, th);
    rectShape.quadraticCurveTo(-w * 1.12, 0, -w, -th);

    const extrudeGeo = new THREE.ExtrudeGeometry(rectShape, {
      steps: 24,
      bevelEnabled: true,
      bevelThickness: 0.007 * S,
      bevelSize: 0.006 * S,
      bevelSegments: 4,
      extrudePath: tailCurve,
    });
    const ribbonMesh = new THREE.Mesh(extrudeGeo, woolMat);
    ribbonMesh.castShadow = true;
    tailGroup.add(ribbonMesh);

    const endPt = curvePts[curvePts.length - 1];
    for (let f = -1.5; f <= 1.5; f += 1) {
      const tassel = new THREE.Mesh(new THREE.CapsuleGeometry(0.009 * S, 0.028 * S, 8, 10), fringeMat);
      const offsetAngle = endAngle + f * 0.05;
      const tr = (findBodyRadiusAtAngle(endY, offsetAngle) + protrude) * S;
      tassel.position.set(Math.sin(offsetAngle) * tr, endPt.y - 0.024 * S, Math.cos(offsetAngle) * tr);
      tassel.rotation.z = -offsetAngle * 0.22;
      tailGroup.add(tassel);
    }

    return tailGroup;
  };

  group.add(buildDrapedTail(0.34, 0.42, -0.06, -0.31, 0.016, 1.0));
  group.add(buildDrapedTail(0.47, 0.58, -0.06, -0.23, 0.008, 0.86));

  return group;
}

/**
 * Iconic Continuous-Brow Nerd-Chic Glasses (1:1 Tribute to User's Favorite Reference Image!):
 * - Soft velvety slate-navy (`#323c50`) continuous gentle brow bar across top of the big round nose
 * - Clean, bright, unobstructed eye windows (ZERO distracting diagonal stripes!) so tiny deadpan dot pupils shine!
 * - Wrapped smoothly around the wide marshmallow head with flush side hinges
 */
export function buildDetailedGlasses(S: number, eyeY: number): THREE.Group {
  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x313b4e,
    roughness: 0.46,
    metalness: 0.08,
  });

  // Clean, ultra-clear subtle glass sheen (zero stripes blocking the tiny dot eyes!)
  const clearLensMat = new THREE.MeshStandardMaterial({
    color: 0xf8fbff,
    transparent: true,
    opacity: 0.16,
    roughness: 0.15,
    metalness: 0.05,
    depthWrite: false,
  });

  const eyewearZ = (x: number, y: number) => {
    const opticalArc = 0.435 - 1.12 * x * x;
    const minClear = findFaceSurfaceZ(x, y) + 0.024;
    return Math.max(opticalArc, minClear);
  };

  const centerX = 0.238;
  const centerY = eyeY + 0.002;
  const halfW = 0.098;
  const halfH = 0.075;

  [-1, 1].forEach((side) => {
    const cx = side * centerX;
    const pts: THREE.Vector3[] = [];
    const steps = 48;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      // Rectangular-rounded boxy nerd frame (exponent 0.52 -> crisp rounded rectangle like reference!)
      const powCos = Math.sign(cosA) * Math.pow(Math.abs(cosA), 0.52);
      const powSin = Math.sign(sinA) * Math.pow(Math.abs(sinA), 0.54);
      // Slight inward curve at bottom-inner corner to hug the big round nose
      const innerTaper = sinA < 0 && side * cosA < 0 ? 0.84 : 1.0;
      const lx = cx + powCos * halfW * innerTaper;
      const ly = centerY + powSin * halfH;
      const wz = eyewearZ(lx, ly) * S;
      pts.push(new THREE.Vector3(lx * S, ly * S, wz));
    }

    const frameCurve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
    const rimMesh = new THREE.Mesh(
      new THREE.TubeGeometry(frameCurve, 72, 0.019 * S, 16, true),
      frameMat
    );
    rimMesh.castShadow = true;
    group.add(rimMesh);

    // Subtle clear lens plane curved inside rim
    const gridN = 6;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let iy = 0; iy <= gridN; iy++) {
      const ny = ((iy / gridN) * 2 - 1) * 0.88;
      for (let ix = 0; ix <= gridN; ix++) {
        const nx = ((ix / gridN) * 2 - 1) * 0.88;
        const px = cx + nx * halfW * 0.92;
        const py = centerY + ny * halfH * 0.92;
        const pz = eyewearZ(px, py) - 0.004;
        pos.push(px * S, py * S, pz * S);
      }
    }
    for (let iy = 0; iy < gridN; iy++) {
      for (let ix = 0; ix < gridN; ix++) {
        const a = iy * (gridN + 1) + ix;
        const b = a + 1;
        const c = a + (gridN + 1);
        const d = c + 1;
        idx.push(a, b, d, a, d, c);
      }
    }
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    lGeo.setIndex(idx);
    lGeo.computeVertexNormals();
    group.add(new THREE.Mesh(lGeo, clearLensMat));

    // Cute side hinge lug + short temple tucking into side of wide head
    const outerX = side * (centerX + halfW * 1.02);
    const outerY = centerY + 0.015;
    const outerZ = eyewearZ(outerX, outerY);
    const lug = new THREE.Mesh(
      new THREE.BoxGeometry(0.028 * S, 0.036 * S, 0.032 * S),
      frameMat
    );
    lug.position.set(outerX * S, outerY * S, outerZ * S);
    lug.rotation.y = side * 0.28;
    group.add(lug);

    const endSurfX = findSurfaceX(outerY - 0.01, 0.04);
    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(outerX * S, outerY * S, outerZ * S),
      new THREE.Vector3(side * (endSurfX + 0.01) * S, outerY * S, 0.16 * S),
      new THREE.Vector3(side * (endSurfX - 0.01) * S, (outerY - 0.01) * S, 0.02 * S),
    ]);
    group.add(
      new THREE.Mesh(new THREE.TubeGeometry(templeCurve, 16, 0.015 * S, 12, false), frameMat)
    );
  });

  // Continuous Bold Brow-Bridge Arch connecting the top-inner corners smoothly over the big round nose!
  const browPts: THREE.Vector3[] = [];
  const spanX = centerX - halfW * 0.65;
  for (let i = 0; i <= 16; i++) {
    const u = (i / 16) * 2 - 1;
    const bx = u * spanX;
    const archY = centerY + halfH * 0.88 + (1 - u * u) * 0.016;
    const bz = Math.max(eyewearZ(bx, archY), 0.448 - 0.35 * bx * bx);
    browPts.push(new THREE.Vector3(bx * S, archY * S, bz * S));
  }
  const browMesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(browPts), 28, 0.020 * S, 14, false),
    frameMat
  );
  browMesh.castShadow = true;
  group.add(browMesh);

  return group;
}

/**
 * Ribbed Knitted Winter Beanie fitted between wide-set ears
 */
export function buildKnittedBeanie(S: number): THREE.Group {
  const group = new THREE.Group();
  const { map, bumpMap } = createKnittedTextures("#313b4e", "#fbbf24");
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
    new THREE.SphereGeometry(0.18 * S, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hatMat
  );
  const cuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.175 * S, 0.038 * S, 16, 36),
    cuffMat
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = 0.012 * S;

  const pomGroup = new THREE.Group();
  pomGroup.position.set(0, 0.195 * S, 0);
  pomGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.052 * S, 16, 16), pomMat));
  sub.add(dome, cuff, pomGroup);
  sub.position.set(0, 0.44 * S, -0.02 * S);
  sub.rotation.x = -0.14;
  group.add(sub);
  return group;
}

/**
 * Plush Earmuffs
 */
export function buildPlushEarmuffs(S: number): THREE.Group {
  const group = new THREE.Group();
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.45 });
  const pinkPlush = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.92 });
  const whiteFleece = new THREE.MeshStandardMaterial({ color: 0xfffdf9, roughness: 0.96 });

  const bandCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.39 * S, 0.34 * S, 0),
    new THREE.Vector3(-0.28 * S, 0.52 * S, 0),
    new THREE.Vector3(0, 0.56 * S, 0),
    new THREE.Vector3(0.28 * S, 0.52 * S, 0),
    new THREE.Vector3(0.39 * S, 0.34 * S, 0),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bandCurve, 28, 0.02, 12, false), bandMat));

  [-1, 1].forEach((side) => {
    const cup = new THREE.Group();
    const cushion = new THREE.Mesh(new THREE.TorusGeometry(0.072 * S, 0.036 * S, 14, 24), whiteFleece);
    cushion.rotation.y = Math.PI / 2;
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.092 * S, 20, 20), pinkPlush);
    outer.scale.set(0.58, 1, 1);
    outer.position.x = side * 0.02 * S;
    cup.add(cushion, outer);
    cup.position.set(side * 0.39 * S, 0.33 * S, 0);
    cup.rotation.z = -side * 0.15;
    group.add(cup);
  });

  return group;
}

/**
 * Cute Plush Silver Codfish
 */
export function buildCuteCodfish(): THREE.Group {
  const g = new THREE.Group();
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, roughness: 0.55 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.65 });
  const eyeDark = new THREE.MeshStandardMaterial({ color: 0x313b4e, roughness: 0.3 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 22, 18), blueMat);
  body.scale.set(1.65, 0.88, 0.65);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.098, 18, 16), bellyMat);
  belly.scale.set(1.5, 0.72, 0.68);
  belly.position.y = -0.022;

  const tailTop = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), blueMat);
  tailTop.scale.set(1.3, 0.65, 0.35);
  tailTop.position.set(0.2, 0.035, 0);
  tailTop.rotation.z = 0.45;

  const tailBot = tailTop.clone();
  tailBot.position.set(0.2, -0.035, 0);
  tailBot.rotation.z = -0.45;

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 12), eyeDark);
  eyeL.position.set(-0.1, 0.02, 0.058);
  const eyeR = eyeL.clone();
  eyeR.position.z = -0.058;

  g.add(body, belly, tailTop, tailBot, eyeL, eyeR);
  return g;
}

/**
 * Radial Soft Glow Texture for Sparkling Room Treasures!
 */
let cachedGlowTex: THREE.CanvasTexture | null = null;
function getTreasureGlowTexture(): THREE.CanvasTexture {
  if (cachedGlowTex) return cachedGlowTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(255, 248, 196, 0.95)");
  grad.addColorStop(0.38, "rgba(253, 224, 71, 0.52)");
  grad.addColorStop(0.72, "rgba(125, 211, 252, 0.22)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  cachedGlowTex = new THREE.CanvasTexture(c);
  cachedGlowTex.colorSpace = THREE.SRGBColorSpace;
  return cachedGlowTex;
}

function createStarSparkleGeometry(radius = 0.055): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  const inner = radius * 0.24;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : inner;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

/**
 * Builds an Eye-Catching Sparkling 3D Room Treasure Pod (Glow Halo + 3D Prop + Twinkling Stars + Hit Sphere)!
 */
export function buildSparklingRoomTreasure(kind: string, slotIndex: number): {
  root: THREE.Group;
  propGroup: THREE.Group;
  haloMesh: THREE.Mesh;
  stars: THREE.Mesh[];
  hitMesh: THREE.Mesh;
} {
  const root = new THREE.Group();
  const propGroup = new THREE.Group();
  root.add(propGroup);

  // 1. Soft Shimmering Floor Halo + Upright Aura Sprite
  const haloMat = new THREE.MeshBasicMaterial({
    map: getTreasureGlowTexture(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.68), haloMat);
  haloMesh.rotation.x = -Math.PI / 2;
  haloMesh.position.y = 0.02;
  root.add(haloMesh);

  const backAura = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.58),
    new THREE.MeshBasicMaterial({
      map: getTreasureGlowTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  backAura.position.set(0, 0.20, -0.04);
  root.add(backAura);

  // 2. Sculpted Cute 3D Treasure Prop
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.32,
    roughness: 0.35,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfef3c7,
    emissiveIntensity: 0.22,
    roughness: 0.5,
  });
  const coralMat = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.2,
    roughness: 0.4,
  });
  const skyGlowMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.3,
    roughness: 0.25,
  });

  if (kind === "fish") {
    const fish = buildCuteCodfish();
    fish.scale.setScalar(1.15);
    fish.rotation.y = -0.3;
    fish.rotation.z = 0.18;
    propGroup.add(fish);
  } else if (kind === "card" || kind === "plane") {
    // Warm glowing letter card with cute coral wax seal!
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.20, 0.026), creamMat);
    card.rotation.z = 0.14;
    card.rotation.x = -0.25;
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.032, 16), coralMat);
    seal.rotation.x = Math.PI / 2 - 0.25;
    seal.position.set(0, 0, 0.012);
    propGroup.add(card, seal);
  } else if (kind === "cocoa") {
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.20, 20), coralMat);
    const foam = new THREE.Mesh(new THREE.SphereGeometry(0.098, 16, 12), creamMat);
    foam.scale.set(1, 0.4, 1);
    foam.position.y = 0.09;
    propGroup.add(mug, foam);
  } else if (kind === "shell" || kind === "acorn") {
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), goldMat);
    pearl.scale.set(1.15, 0.85, 0.9);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.135, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
      coralMat
    );
    cap.position.y = 0.02;
    propGroup.add(pearl, cap);
  } else {
    // Glowing Aurora Star Jar / Crystal / Golden Bell
    const jarGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.125, 0.23, 20),
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.58,
        roughness: 0.12,
      })
    );
    const innerStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), goldMat);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.045, 16), coralMat);
    cork.position.y = 0.125;
    const glowCore = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 14), skyGlowMat);
    glowCore.position.y = -0.02;
    propGroup.add(jarGlass, innerStar, cork, glowCore);
  }
  propGroup.position.y = 0.21;

  // 3. Three Twinkling 4-Point Diamond Sparkles around the prop!
  const starGeo = createStarSparkleGeometry(0.052);
  const starMatWhite = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
  });
  const starMatGold = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    side: THREE.DoubleSide,
  });

  const stars: THREE.Mesh[] = [];
  const starOffsets = [
    { x: -0.18, y: 0.36, z: 0.08 },
    { x: 0.19, y: 0.28, z: 0.10 },
    { x: 0.03, y: 0.44, z: 0.06 },
  ];
  starOffsets.forEach((so, idx) => {
    const st = new THREE.Mesh(starGeo, idx % 2 === 0 ? starMatGold : starMatWhite);
    st.position.set(so.x, so.y, so.z);
    root.add(st);
    stars.push(st);
  });

  // 4. Generous Invisible Raycast Sphere (`hoard_0`, `hoard_1`, `hoard_2`)
  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitMesh.position.y = 0.22;
  hitMesh.name = `hoard_${slotIndex}`;
  root.add(hitMesh);

  return { root, propGroup, haloMesh, stars, hitMesh };
}
