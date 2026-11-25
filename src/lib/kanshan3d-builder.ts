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
 * Photo-Accurate Canonical Standing 3D Liu Kanshan SDF (from Reference Photos 1–4):
 * - Smooth pear-cylinder upright white body: straight continuous back line & gently full rounded lower belly
 * - Bold, iconic horizontal/slightly-upturned conical fox snout with smooth concave throat curve underneath
 * - Upright pointed-rounded Arctic Fox ears set at the top-back of the head
 */
export function evalCartoonKanshanSDF(x: number, y: number, z: number): number {
  // 1. Tall pear-capsule torso: straight back (~z = -0.29), gently full lower belly, smooth rounded bottom
  const dTorsoRaw = sdTaperedCapsule(
    x * 0.98,
    y,
    z,
    0,
    -0.21,
    0.025,
    0,
    0.24,
    -0.02,
    0.335,
    0.268
  );
  // Smoothly round/level the under-belly where the two standing black legs emerge
  const dTorsoBottom = smax(dTorsoRaw, -(y + 0.505), 0.085);
  // Softly level the crown dome between the ears
  const dTorso = smax(dTorsoBottom, y - 0.445, 0.075);

  // 2. Upright conical-rounded Arctic Fox ears at the top-back of the head (continuing the straight back!)
  const ax = Math.abs(x);
  const dEar = sdTaperedCapsule(
    ax,
    y,
    (z + 0.085) * 1.22,
    0.148,
    0.34,
    0,
    0.162,
    0.675,
    0,
    0.112,
    0.034
  );
  const dHeadEars = smin(dTorso, dEar, 0.052);

  // 3. Signature bold, slightly upturned conical fox snout!
  const dSnout = sdTaperedCapsule(
    x * 0.96,
    y,
    z,
    0,
    0.215,
    0.04,
    0,
    0.308,
    0.455,
    0.205,
    0.126
  );

  return smin(dHeadEars, dSnout, 0.115);
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
  const mc = new MarchingCubes(resolution, material, false, false, 200000);
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
 * Slender Charcoal-Black Arm + Cute 4-Fingered Hand (3 plump fingers + 1 opposable thumb, per Photos 1–4!)
 */
export function buildFourFingeredArm(
  side: number,
  S: number,
  limbMat: THREE.Material
): THREE.Group {
  const armY = 0.02;
  const armZ = -0.01;
  const shoulderSurfX = findSurfaceX(armY, armZ);

  const pivot = new THREE.Group();
  pivot.position.set(side * (shoulderSurfX - 0.032) * S, armY * S, armZ * S);

  // Seamless shoulder joint sphere tucked inside torso
  const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.042 * S, 16, 16), limbMat);
  pivot.add(shoulderCap);

  // Gently curved slender charcoal arm
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(side * 0.055 * S, -0.15 * S, 0.018 * S),
    new THREE.Vector3(side * 0.052 * S, -0.31 * S, 0.048 * S),
  ]);

  const armTube = new THREE.Mesh(
    new THREE.TubeGeometry(armCurve, 22, 0.038 * S, 16, false),
    limbMat
  );
  armTube.castShadow = true;
  pivot.add(armTube);

  // Cute 4-Fingered Mitten Hand (Palm + Thumb + 3 Rounded Fingers!)
  const handGroup = new THREE.Group();
  handGroup.position.set(side * 0.052 * S, -0.32 * S, 0.052 * S);

  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.052 * S, 18, 16), limbMat);
  palm.scale.set(0.78, 1.05, 0.95);
  palm.castShadow = true;
  handGroup.add(palm);

  // Thumb pointing forward/upward
  const thumb = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.017 * S, 0.032 * S, 8, 12),
    limbMat
  );
  thumb.position.set(-side * 0.012 * S, -0.01 * S, 0.048 * S);
  thumb.rotation.x = Math.PI * 0.34;
  thumb.rotation.z = side * 0.25;
  handGroup.add(thumb);

  // 3 plump rounded fingers fanned slightly (exact silhouette from Photos 1, 2, 4!)
  [-0.24, 0, 0.24].forEach((fan, idx) => {
    const len = idx === 1 ? 0.042 * S : 0.036 * S;
    const finger = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0165 * S, len, 8, 12),
      limbMat
    );
    finger.position.set(
      side * 0.004 * S,
      (-0.048 - (idx === 1 ? 0.004 : 0)) * S,
      (-fan * 0.095 + 0.006) * S
    );
    finger.rotation.x = -fan * 0.55 + 0.12;
    finger.castShadow = true;
    handGroup.add(finger);
  });

  pivot.add(handGroup);
  return pivot;
}

/**
 * Sturdy Charcoal-Black Standing Leg + Plump Forward-Rounded Boot (Sole strictly at local y = -0.34 * S, per Photos 3 & 4!)
 */
export function buildStandingLeg(
  side: number,
  S: number,
  limbMat: THREE.Material
): THREE.Group {
  const hipPivot = new THREE.Group();
  hipPivot.position.set(side * 0.145 * S, -0.455 * S, -0.005 * S);

  // Hip joint sphere tucked cleanly inside white lower belly
  const hipCap = new THREE.Mesh(new THREE.SphereGeometry(0.058 * S, 16, 16), limbMat);
  hipPivot.add(hipCap);

  // Sturdy vertical charcoal leg cylinder
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.054 * S, 0.060 * S, 0.26 * S, 22),
    limbMat
  );
  shaft.position.y = -0.135 * S;
  shaft.castShadow = true;
  hipPivot.add(shaft);

  // Plump forward-pointing rounded boot/foot (flat cushioned sole at y = -0.34 * S!)
  const bootGroup = new THREE.Group();
  bootGroup.position.set(0, -0.285 * S, 0.042 * S);

  const bootMain = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.056 * S, 0.078 * S, 14, 20),
    limbMat
  );
  bootMain.rotation.x = Math.PI / 2;
  bootMain.scale.set(1.12, 1.0, 0.96);
  bootMain.castShadow = true;
  bootMain.receiveShadow = true;
  bootGroup.add(bootMain);

  // Subtle rounded heel blend
  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.058 * S, 16, 14), limbMat);
  heel.scale.set(1.04, 0.92, 1.0);
  heel.position.set(0, 0.004 * S, -0.036 * S);
  bootGroup.add(heel);

  hipPivot.add(bootGroup);
  return hipPivot;
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
 * Flush Contoured Knitted Scarf fitted around Standing Liu Kanshan's neck (y ≈ 0.085)
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
    new THREE.TubeGeometry(makeCoilCurve(0.068, -0.010, 0.028, 0.004), 72, 0.036 * S, 18, true),
    woolMat
  );
  lowerCoil.castShadow = true;
  group.add(lowerCoil);

  const upperCoil = new THREE.Mesh(
    new THREE.TubeGeometry(makeCoilCurve(0.108, -0.008, 0.022, -0.003), 72, 0.034 * S, 18, true),
    woolMat
  );
  upperCoil.castShadow = true;
  group.add(upperCoil);

  const knotAngle = 0.32;
  const knotY = 0.048;
  const knotR = (findBodyRadiusAtAngle(knotY, knotAngle) + 0.014) * S;
  const knotMesh = new THREE.Mesh(new THREE.SphereGeometry(0.052 * S, 20, 20), woolMat);
  knotMesh.scale.set(1.16, 0.92, 0.88);
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
      const r = (findBodyRadiusAtAngle(y, ang) + protrude + Math.sin(t * Math.PI) * 0.01) * S;
      curvePts.push(new THREE.Vector3(Math.sin(ang) * r, y * S, Math.cos(ang) * r));
    }
    const tailCurve = new THREE.CatmullRomCurve3(curvePts);

    const w = 0.044 * S * widthScale;
    const th = 0.013 * S;
    const rectShape = new THREE.Shape();
    rectShape.moveTo(-w, -th);
    rectShape.quadraticCurveTo(0, -th * 1.25, w, -th);
    rectShape.quadraticCurveTo(w * 1.12, 0, w, th);
    rectShape.quadraticCurveTo(0, th * 1.25, -w, th);
    rectShape.quadraticCurveTo(-w * 1.12, 0, -w, -th);

    const extrudeGeo = new THREE.ExtrudeGeometry(rectShape, {
      steps: 20,
      bevelEnabled: true,
      bevelThickness: 0.006 * S,
      bevelSize: 0.005 * S,
      bevelSegments: 4,
      extrudePath: tailCurve,
    });
    const ribbonMesh = new THREE.Mesh(extrudeGeo, woolMat);
    ribbonMesh.castShadow = true;
    tailGroup.add(ribbonMesh);

    const endPt = curvePts[curvePts.length - 1];
    for (let f = -1.5; f <= 1.5; f += 1) {
      const tassel = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0075 * S, 0.022 * S, 8, 10),
        fringeMat
      );
      const offsetAngle = endAngle + f * 0.05;
      const tr = (findBodyRadiusAtAngle(endY, offsetAngle) + protrude) * S;
      tassel.position.set(
        Math.sin(offsetAngle) * tr,
        endPt.y - 0.02 * S,
        Math.cos(offsetAngle) * tr
      );
      tassel.rotation.z = -offsetAngle * 0.22;
      tailGroup.add(tassel);
    }

    return tailGroup;
  };

  group.add(buildDrapedTail(0.30, 0.36, 0.04, -0.19, 0.014, 1.0));
  group.add(buildDrapedTail(0.42, 0.50, 0.04, -0.12, 0.008, 0.86));

  return group;
}

/**
 * Glasses contoured cleanly over Standing Liu Kanshan's eyes & upper snout bridge
 */
export function buildDetailedGlasses(S: number, eyeY: number): THREE.Group {
  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x232936,
    roughness: 0.42,
    metalness: 0.08,
  });

  const eyewearZ = (x: number, y: number) => findFaceSurfaceZ(x, y) + 0.018;

  const centerX = 0.188;
  const centerY = eyeY + 0.004;
  const halfW = 0.072;
  const halfH = 0.062;

  [-1, 1].forEach((side) => {
    const cx = side * centerX;
    const pts: THREE.Vector3[] = [];
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const cosA = Math.cos(a);
      const sinA = Math.sin(a);
      const powCos = Math.sign(cosA) * Math.pow(Math.abs(cosA), 0.58);
      const powSin = Math.sign(sinA) * Math.pow(Math.abs(sinA), 0.58);
      const lx = cx + powCos * halfW;
      const ly = centerY + powSin * halfH;
      const wz = eyewearZ(lx, ly) * S;
      pts.push(new THREE.Vector3(lx * S, ly * S, wz));
    }

    const frameCurve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
    const rimMesh = new THREE.Mesh(
      new THREE.TubeGeometry(frameCurve, 56, 0.014 * S, 14, true),
      frameMat
    );
    rimMesh.castShadow = true;
    group.add(rimMesh);

    const outerX = side * (centerX + halfW);
    const outerY = centerY + 0.01;
    const outerZ = eyewearZ(outerX, outerY);
    const endSurfX = findSurfaceX(outerY, -0.04);
    const templeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(outerX * S, outerY * S, outerZ * S),
      new THREE.Vector3(side * (endSurfX + 0.01) * S, outerY * S, 0.06 * S),
      new THREE.Vector3(side * (endSurfX - 0.005) * S, outerY * S, -0.06 * S),
    ]);
    group.add(
      new THREE.Mesh(new THREE.TubeGeometry(templeCurve, 14, 0.012 * S, 10, false), frameMat)
    );
  });

  // Bridge arching cleanly over the snout root!
  const browPts: THREE.Vector3[] = [];
  const spanX = centerX - halfW * 0.72;
  for (let i = 0; i <= 16; i++) {
    const u = (i / 16) * 2 - 1;
    const bx = u * spanX;
    const archY = centerY + halfH * 0.65 + (1 - u * u) * 0.052;
    const bz = findFaceSurfaceZ(bx, archY) + 0.018;
    browPts.push(new THREE.Vector3(bx * S, archY * S, bz * S));
  }
  const browMesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(browPts), 24, 0.014 * S, 12, false),
    frameMat
  );
  browMesh.castShadow = true;
  group.add(browMesh);

  return group;
}

/**
 * Ribbed Knitted Winter Beanie fitted between upright fox ears
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
    new THREE.SphereGeometry(0.128 * S, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hatMat
  );
  const cuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.125 * S, 0.028 * S, 14, 32),
    cuffMat
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = 0.01 * S;

  const pomGroup = new THREE.Group();
  pomGroup.position.set(0, 0.145 * S, 0);
  pomGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.038 * S, 14, 14), pomMat));
  sub.add(dome, cuff, pomGroup);
  sub.position.set(0, 0.435 * S, -0.05 * S);
  sub.rotation.x = -0.1;
  group.add(sub);
  return group;
}

/**
 * Plush Earmuffs fitted to standing head
 */
export function buildPlushEarmuffs(S: number): THREE.Group {
  const group = new THREE.Group();
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.45 });
  const pinkPlush = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.92 });
  const whiteFleece = new THREE.MeshStandardMaterial({ color: 0xfffdf9, roughness: 0.96 });

  const bandCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.27 * S, 0.34 * S, -0.06 * S),
    new THREE.Vector3(-0.22 * S, 0.50 * S, -0.06 * S),
    new THREE.Vector3(0, 0.54 * S, -0.06 * S),
    new THREE.Vector3(0.22 * S, 0.50 * S, -0.06 * S),
    new THREE.Vector3(0.27 * S, 0.34 * S, -0.06 * S),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bandCurve, 28, 0.016 * S, 12, false), bandMat));

  [-1, 1].forEach((side) => {
    const cup = new THREE.Group();
    const cushion = new THREE.Mesh(
      new THREE.TorusGeometry(0.058 * S, 0.028 * S, 14, 24),
      whiteFleece
    );
    cushion.rotation.y = Math.PI / 2;
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.075 * S, 20, 20), pinkPlush);
    outer.scale.set(0.58, 1, 1);
    outer.position.x = side * 0.018 * S;
    cup.add(cushion, outer);
    cup.position.set(side * 0.275 * S, 0.33 * S, -0.06 * S);
    cup.rotation.z = -side * 0.12;
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

function createStarSparkleGeometry(radius = 0.026): THREE.ShapeGeometry {
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
 * Delicate, Grounded Miniature 3D Room Treasure Pod (bottom strictly at y >= 0, subtle low-key shimmer)
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

  const haloMat = new THREE.MeshBasicMaterial({
    map: getTreasureGlowTexture(),
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), haloMat);
  haloMesh.rotation.x = -Math.PI / 2;
  haloMesh.position.y = 0.005;
  root.add(haloMesh);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.14,
    roughness: 0.44,
  });
  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfef3c7,
    emissiveIntensity: 0.10,
    roughness: 0.55,
  });
  const coralMat = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.08,
    roughness: 0.48,
  });
  const skyGlowMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.14,
    roughness: 0.34,
  });

  const mini = new THREE.Group();
  const P = 0.54;

  if (kind === "fish") {
    const fish = buildCuteCodfish();
    fish.scale.setScalar(0.85 * P);
    fish.rotation.x = 0.5;
    fish.rotation.y = -0.35;
    fish.position.y = 0.065 * P;
    mini.add(fish);
  } else if (kind === "card" || kind === "plane") {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.25 * P, 0.025 * P, 0.18 * P), creamMat);
    card.position.y = 0.014 * P;
    card.rotation.y = 0.28;
    const seal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035 * P, 0.035 * P, 0.018 * P, 16),
      coralMat
    );
    seal.position.set(0, 0.028 * P, 0);
    mini.add(card, seal);
  } else if (kind === "cocoa") {
    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10 * P, 0.088 * P, 0.18 * P, 20),
      coralMat
    );
    mug.position.y = 0.09 * P;
    const foam = new THREE.Mesh(new THREE.SphereGeometry(0.09 * P, 16, 12), creamMat);
    foam.scale.set(1, 0.38, 1);
    foam.position.y = 0.175 * P;
    mini.add(mug, foam);
  } else if (kind === "shell" || kind === "acorn") {
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.11 * P, 20, 16), goldMat);
    pearl.scale.set(1.12, 0.82, 0.92);
    pearl.position.y = 0.092 * P;
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.115 * P, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
      coralMat
    );
    cap.position.y = 0.105 * P;
    mini.add(pearl, cap);
  } else {
    const jarGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.098 * P, 0.112 * P, 0.19 * P, 20),
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.65,
        roughness: 0.18,
      })
    );
    jarGlass.position.y = 0.096 * P;
    const innerStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.06 * P, 0), goldMat);
    innerStar.position.y = 0.096 * P;
    const cork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075 * P, 0.08 * P, 0.038 * P, 16),
      coralMat
    );
    cork.position.y = 0.20 * P;
    const glowCore = new THREE.Mesh(new THREE.SphereGeometry(0.04 * P, 14, 14), skyGlowMat);
    glowCore.position.y = 0.08 * P;
    mini.add(jarGlass, innerStar, cork, glowCore);
  }

  propGroup.add(mini);
  propGroup.position.y = 0.01;

  const starGeo = createStarSparkleGeometry(0.024);
  const starMatGold = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });
  const starMatWhite = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });

  const stars: THREE.Mesh[] = [];
  [
    { x: -0.085, y: 0.175, z: 0.04 },
    { x: 0.095, y: 0.14, z: 0.05 },
  ].forEach((so, idx) => {
    const st = new THREE.Mesh(starGeo, idx % 2 === 0 ? starMatGold : starMatWhite);
    st.position.set(so.x, so.y, so.z);
    root.add(st);
    stars.push(st);
  });

  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 12, 12),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  hitMesh.position.y = 0.10;
  hitMesh.name = `hoard_${slotIndex}`;
  root.add(hitMesh);

  return { root, propGroup, haloMesh, stars, hitMesh };
}
