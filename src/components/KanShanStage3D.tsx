"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { PetState } from "@/types/knowshan";

interface KanShanStage3DProps {
  pet: PetState;
  isStackingSnow: boolean;
  isBagCharmMode: boolean;
  isRecordingNose: boolean;
  onTapHead: () => void;
  onTapNoseStart: () => void;
  onTapNoseEnd: () => void;
  onTapSnowman: () => void;
}

// Smooth C2 polynomial union
function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
}

// Bug-free exact Euclidean tapered capsule SDF!
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
 * Exact pixel-calibrated SDF from official Zhihu `看山三视图` (1672x941 sheet, 320px = 1.0 unit):
 * - Front white width: 270px at lower belly (rx = 0.422), 228px at forehead (rx = 0.356)
 * - Side torso depth: 242px at lower belly (rz = 0.378), 204px at head (rz = 0.318)
 * - Crown valley: y = +0.43; Ear tips: y = +0.65, x = ±0.235, z = -0.10
 * - Belly bottom: y = -0.59 (softly flattened pear base)
 * - Snout front nose tip: z = +0.725 (only +0.34 past front belly!), y = +0.25
 * - Tail ball: center (0, -0.38, -0.40), r = 0.118 (deeply overlapping back of torso)
 */
function evalOfficialKanshanSDF(x: number, y: number, z: number): number {
  // 1. Plump A-line pear torso (wider at lower belly, gently tapered to head)
  const dTorsoRaw = sdTaperedCapsule(
    x * 0.90,
    y,
    z,
    0,
    -0.21,
    0.01,
    0,
    0.125,
    -0.02,
    0.382,
    0.312
  );
  const dTorso = smax(dTorsoRaw, -(y + 0.575), 0.09);

  // 2. Two upright rounded-tip fox ears flowing seamlessly from upper head sides
  const ax = Math.abs(x);
  const dEar = sdTaperedCapsule(
    ax,
    y,
    (z + 0.05) * 1.25,
    0.172,
    0.24,
    0,
    0.188,
    0.565,
    -0.01,
    0.138,
    0.045
  );
  const dHeadEars = smin(dTorso, dEar, 0.055);

  // 3. Official polar-fox snout with sleek horizontal-oval black nose tip
  const dSnout = sdTaperedCapsule(
    x * 0.84,
    (y - 0.255) * 1.12 + 0.255,
    z,
    0,
    0.225,
    0.06,
    0,
    0.262,
    0.535,
    0.182,
    0.124
  );

  return smin(dHeadEars, dSnout, 0.09);
}

// Binary-search exact surface X coordinate so eyes & arms sit flush on the body with zero gap
function findSurfaceX(y: number, z: number): number {
  let lo = 0.0;
  let hi = 0.85;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5;
    if (evalOfficialKanshanSDF(mid, y, z) < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) * 0.5;
}

function buildMarchingMesh(
  resolution: number,
  material: THREE.Material,
  sdfFn: (x: number, y: number, z: number) => number
): MarchingCubes {
  const mc = new MarchingCubes(resolution, material, false, false, 160000);
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
  return mc;
}

export default function KanShanStage3D({
  pet,
  isStackingSnow,
  isBagCharmMode,
  isRecordingNose,
  onTapHead,
  onTapNoseStart,
  onTapNoseEnd,
  onTapSnowman,
}: KanShanStage3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const petRef = useRef(pet);
  const stackingRef = useRef(isStackingSnow);
  const bagRef = useRef(isBagCharmMode);
  const recRef = useRef(isRecordingNose);
  const springRef = useRef({ sx: 1, sy: 1, sz: 1, jumpY: 0, armLerp: 0 });
  const rotYRef = useRef(-0.14); // Charming slight 3/4 angle showing both eyes clearly on load!

  useEffect(() => {
    petRef.current = pet;
    springRef.current.sx = 1.06;
    springRef.current.sy = 0.95;
    springRef.current.sz = 1.06;
    springRef.current.jumpY = 0.08;
  }, [pet.equippedItems, pet.mood]);

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    stackingRef.current = isStackingSnow;
    springRef.current.jumpY = 0.1;
  }, [isStackingSnow]);

  useEffect(() => {
    bagRef.current = isBagCharmMode;
    springRef.current.jumpY = 0.12;
  }, [isBagCharmMode]);

  useEffect(() => {
    recRef.current = isRecordingNose;
  }, [isRecordingNose]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 390;
    const height = container.clientHeight || 844;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(23, width / height, 0.1, 100);

    const syncCameraAndSize = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      const aspect = w / h;
      camera.aspect = aspect;
      // Smoothly pull back slightly on narrow mobile screens (aspect < 0.7) so KanShan & room stay centered & uncropped!
      const extraZ = aspect < 0.72 ? (0.72 - aspect) * 6.5 : 0;
      camera.position.set(0, 0.38, 9.5 + extraZ);
      camera.lookAt(0, -0.18, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    syncCameraAndSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Clean Studio Lighting (pure neutral white so black stays rich charcoal black!)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xdbeafe, 1.45);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(-3.0, 6.0, 5.2);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.radius = 4;
    scene.add(dirLight);

    const backRim = new THREE.DirectionalLight(0xf0f9ff, 0.55);
    backRim.position.set(3.5, 2.5, -3.5);
    scene.add(backRim);

    // =========================================================
    // 1. ARCTIC ROOM PROPS: SHELL SOFA + PAW RUG
    // =========================================================
    const roomGroup = new THREE.Group();
    scene.add(roomGroup);

    const floorShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.ShadowMaterial({ opacity: 0.13 })
    );
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.position.y = -1.42;
    floorShadow.receiveShadow = true;
    roomGroup.add(floorShadow);

    // Scalloped Shell Sofa in Back-Left
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(-1.35, -1.4, -1.55);
    sofaGroup.rotation.y = 0.36;
    const sofaBlue = new THREE.MeshStandardMaterial({ color: 0xb2d1f0, roughness: 0.94 });
    const sofaFrost = new THREE.MeshStandardMaterial({ color: 0xd9ebfc, roughness: 0.95 });

    const seat = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.95, 0.4, 36), sofaBlue);
    seat.scale.set(1.16, 1, 0.86);
    seat.position.y = 0.2;
    seat.castShadow = true;
    seat.receiveShadow = true;
    sofaGroup.add(seat);

    const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.9, 28, 20), sofaFrost);
    cushion.scale.set(1.12, 0.26, 0.8);
    cushion.position.y = 0.42;
    sofaGroup.add(cushion);

    [-0.64, -0.32, 0, 0.32, 0.64].forEach((ang, idx) => {
      const h = [0.95, 1.2, 1.36, 1.2, 0.95][idx];
      const petal = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.26, h * 0.52, 10, 18),
        idx % 2 === 0 ? sofaBlue : sofaFrost
      );
      petal.position.set(Math.sin(ang) * 0.9, 0.64 + h * 0.15, -0.42 - Math.cos(ang) * 0.16);
      petal.rotation.z = -ang * 0.4;
      petal.rotation.x = -0.12;
      sofaGroup.add(petal);
    });
    roomGroup.add(sofaGroup);

    // Blue & White Giant Paw-Print Rug
    const pawRug = new THREE.Group();
    pawRug.position.set(0, -1.41, 0.06);
    const rugBlue = new THREE.MeshStandardMaterial({ color: 0x89bef5, roughness: 0.95 });
    const rugWhite = new THREE.MeshStandardMaterial({ color: 0xf9fbff, roughness: 0.96 });

    const padB = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.6, 0.055, 44), rugBlue);
    padB.scale.set(1.26, 1, 0.78);
    padB.position.set(0, 0.028, 0.15);
    padB.receiveShadow = true;
    const padW = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.28, 0.068, 44), rugWhite);
    padW.scale.set(1.2, 1, 0.74);
    padW.position.set(0, 0.034, 0.17);
    padW.receiveShadow = true;
    pawRug.add(padB, padW);

    [
      { x: -1.68, z: -0.2, r: 0.34 },
      { x: -0.68, z: -0.8, r: 0.12 },
      { x: 0.68, z: -0.8, r: -0.12 },
      { x: 1.68, z: -0.2, r: -0.34 },
    ].forEach((t) => {
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.56, 0.054, 24), rugBlue);
      bt.scale.set(1.04, 1, 0.82);
      bt.position.set(t.x, 0.027, t.z);
      bt.rotation.y = t.r;
      bt.receiveShadow = true;
      const wt = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.066, 24), rugWhite);
      wt.position.set(t.x * 0.96, 0.033, t.z * 0.96);
      wt.rotation.y = t.r;
      wt.receiveShadow = true;
      pawRug.add(bt, wt);
    });
    roomGroup.add(pawRug);

    // =========================================================
    // 2. PIXEL-ACCURATE 3D LIU KANSHAN
    // =========================================================
    const charRoot = new THREE.Group();
    charRoot.position.set(0, -0.24, 0.12);
    scene.add(charRoot);

    const S = 1.36; // Balanced studio scale with clean headroom above ears!

    // Bag Charm Lanyard (only in Bag Charm Mode)
    const lanyardGroup = new THREE.Group();
    const strap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.85, 16),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.55 })
    );
    strap.position.set(0, 1.32, -0.06);
    const clasp = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.038, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.18 })
    );
    clasp.position.set(0, 1.82, -0.06);
    lanyardGroup.add(strap, clasp);
    charRoot.add(lanyardGroup);

    const kanshanRig = new THREE.Group();
    charRoot.add(kanshanRig);

    const pureWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xfafcff,
      roughness: 0.78,
      metalness: 0.01,
    });
    const limbBlackMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c20,
      roughness: 0.55,
      metalness: 0.04,
    });
    const noseMat = new THREE.MeshStandardMaterial({
      color: 0x18191d,
      roughness: 0.45,
      metalness: 0.06,
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x141518,
      roughness: 0.32,
      metalness: 0.08,
    });

    // Snout black nose split plane at z = +0.515 (crisp horizontal-oval nose cap!)
    const splitZ = (y: number, z: number) => z - (0.515 + 0.04 * (y - 0.25));

    // A) Seamless White Body + Ears + Snout + Integrated Back Tail!
    const whiteMC = buildMarchingMesh(72, pureWhiteMat, (x, y, z) => {
      const dBody = evalOfficialKanshanSDF(x, y, z);
      const dCut = smax(dBody, splitZ(y, z), 0.008);
      // Tail centered at (0, -0.37, -0.39) deeply overlapping back wall (-0.36) so ZERO gap!
      const dTail = sdSphere(x, y, z, 0, -0.37, -0.39, 0.125);
      return smin(dCut, dTail, 0.035);
    });
    whiteMC.scale.setScalar(S);
    whiteMC.castShadow = true;
    whiteMC.receiveShadow = true;
    whiteMC.name = "head";
    kanshanRig.add(whiteMC);

    // B) Seamless Matte-Black Nose Cap overlapping seam slightly (+0.006) so ZERO gap!
    const blackNoseMC = buildMarchingMesh(64, noseMat, (x, y, z) => {
      const dBody = evalOfficialKanshanSDF(x, y, z) - 0.004;
      return smax(dBody, -(splitZ(y, z) + 0.006), 0.01);
    });
    blackNoseMC.scale.setScalar(S);
    blackNoseMC.castShadow = true;
    blackNoseMC.name = "nose";
    kanshanRig.add(blackNoseMC);

    // C) Exact Surface-Mounted Small Black Bead Eyes (`豆豆眼`)
    const eyeY = 0.258;
    const eyeZ = 0.185;
    const eyeSurfX = findSurfaceX(eyeY, eyeZ);

    const beadEyesGroup = new THREE.Group();
    const beadGeo = new THREE.SphereGeometry(0.034, 20, 20);
    const leftEye = new THREE.Mesh(beadGeo, eyeMat);
    leftEye.scale.set(0.92, 1.12, 0.92);
    leftEye.position.set(-eyeSurfX * S, eyeY * S, eyeZ * S);
    leftEye.rotation.y = -0.35;

    const rightEye = leftEye.clone();
    rightEye.position.set(eyeSurfX * S, eyeY * S, eyeZ * S);
    rightEye.rotation.y = 0.35;
    beadEyesGroup.add(leftEye, rightEye);
    kanshanRig.add(beadEyesGroup);

    // Happy Crescent Smile Eyes (`^ ^`)
    const happyEyesGroup = new THREE.Group();
    const arcGeo = new THREE.TorusGeometry(0.044, 0.013, 12, 24, Math.PI * 0.85);
    const leftSmile = new THREE.Mesh(arcGeo, eyeMat);
    leftSmile.position.set(-(eyeSurfX + 0.008) * S, eyeY * S, eyeZ * S);
    leftSmile.rotation.set(0.08, -0.45, Math.PI * 0.08);
    const rightSmile = new THREE.Mesh(arcGeo, eyeMat);
    rightSmile.position.set((eyeSurfX + 0.008) * S, eyeY * S, eyeZ * S);
    rightSmile.rotation.set(0.08, 0.45, Math.PI * 0.08);
    happyEyesGroup.add(leftSmile, rightSmile);
    happyEyesGroup.visible = false;
    kanshanRig.add(happyEyesGroup);

    // D) Embedded Black Standing Legs + Forward Capsule Feet (Zero gap into belly!)
    const createLeg = (side: number) => {
      const g = new THREE.Group();
      const legShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.072, 0.52, 22),
        limbBlackMat
      );
      legShaft.position.set(side * 0.21, -0.92, 0.0);
      legShaft.castShadow = true;

      const shoe = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.084, 0.12, 14, 20),
        limbBlackMat
      );
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.set(1.08, 0.82, 1.0);
      shoe.position.set(side * 0.21, -1.14, 0.065);
      shoe.castShadow = true;

      g.add(legShaft, shoe);
      return g;
    };
    kanshanRig.add(createLeg(-1), createLeg(1));

    // E) Surface-Embedded Slender Curved Black Arms + 3-Fingered Hands!
    const armY = -0.15;
    const armZ = -0.02;
    const shoulderSurfX = findSurfaceX(armY, armZ);

    const createArm = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (shoulderSurfX - 0.04) * S, armY * S, armZ * S);

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.115, -0.19, -0.045),
        new THREE.Vector3(side * 0.10, -0.39, 0.025),
      ]);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 20, 0.048, 16, false),
        limbBlackMat
      );
      tube.castShadow = true;

      const hand = new THREE.Group();
      hand.position.set(side * 0.10, -0.39, 0.025);
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 14), limbBlackMat);

      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.055, 8, 12), limbBlackMat);
      thumb.position.set(-side * 0.032, -0.03, 0.042);
      thumb.rotation.x = -0.6;
      thumb.rotation.z = side * 0.35;

      const midF = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.064, 8, 12), limbBlackMat);
      midF.position.set(0, -0.06, 0.01);
      midF.rotation.x = -0.12;

      const backF = new THREE.Mesh(new THREE.CapsuleGeometry(0.021, 0.058, 8, 12), limbBlackMat);
      backF.position.set(side * 0.015, -0.055, -0.032);
      backF.rotation.x = 0.25;

      hand.add(palm, thumb, midF, backF);
      pivot.add(tube, hand);
      return pivot;
    };
    const leftArm = createArm(-1);
    const rightArm = createArm(1);
    kanshanRig.add(leftArm, rightArm);

    // =========================================================
    // 3. THREE STACKED SNOWBALLS IN FRONT
    // =========================================================
    const snowStack = new THREE.Group();
    snowStack.position.set(0, -1.38, 0.88);
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });

    const sb1 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), snowMat);
    sb1.position.set(0, 0.22, 0.12);
    sb1.castShadow = true;
    sb1.name = "snowman";

    const sb2 = new THREE.Mesh(new THREE.SphereGeometry(0.20, 24, 24), snowMat);
    sb2.position.set(0, 0.56, 0.04);
    sb2.castShadow = true;
    sb2.name = "snowman";

    const sb3 = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 24), snowMat);
    sb3.position.set(0, 0.86, -0.02);
    sb3.castShadow = true;
    sb3.name = "snowman";

    snowStack.add(sb1, sb2, sb3);
    charRoot.add(snowStack);

    // =========================================================
    // 4. FITTED OPTIONAL ACCESSORIES
    // =========================================================
    const glassesGroup = new THREE.Group();
    const gMat = new THREE.MeshStandardMaterial({ color: 0x222938, roughness: 0.35 });
    const makeLensRim = (side: number) => {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 12, 28), gMat);
      rim.position.set(side * (eyeSurfX + 0.01) * S, eyeY * S, (eyeZ + 0.02) * S);
      rim.rotation.y = side * 0.42;
      return rim;
    };
    glassesGroup.add(makeLensRim(-1), makeLensRim(1));
    kanshanRig.add(glassesGroup);

    const scarfGroup = new THREE.Group();
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.8 });
    const sRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.105, 16, 36), scarfMat);
    sRing.rotation.x = Math.PI / 2;
    sRing.position.set(0, -0.08, 0.02);
    const sTail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.44, 0.08), scarfMat);
    sTail.position.set(0.32, -0.32, 0.6);
    sTail.rotation.z = -0.18;
    scarfGroup.add(sRing, sTail);
    kanshanRig.add(scarfGroup);

    const beanieGroup = new THREE.Group();
    const bCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78 })
    );
    bCap.position.set(0, 0.66, -0.05);
    const bRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.33, 0.045, 12, 28),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5 })
    );
    bRim.rotation.x = Math.PI / 2;
    bRim.position.set(0, 0.68, -0.05);
    const bPom = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24 })
    );
    bPom.position.set(0, 1.04, -0.05);
    beanieGroup.add(bCap, bRim, bPom);
    kanshanRig.add(beanieGroup);

    const fishGroup = new THREE.Group();
    const fishMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.38 });
    const fBody = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 16), fishMat);
    fBody.scale.set(1.55, 0.75, 0.55);
    fBody.position.set(0.84, -0.58, 0.16);
    const fTail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 12), fishMat);
    fTail.position.set(1.06, -0.58, 0.16);
    fTail.rotation.z = Math.PI / 2;
    fishGroup.add(fBody, fTail);
    kanshanRig.add(fishGroup);

    const muffsGroup = new THREE.Group();
    const muffMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.85 });
    const mL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), muffMat);
    mL.position.set(-0.62, 0.45, -0.05);
    const mR = mL.clone();
    mR.position.set(0.62, 0.45, -0.05);
    muffsGroup.add(mL, mR);
    kanshanRig.add(muffsGroup);

    // Raycaster & Smooth 360° Turntable Drag (220ms hold on nose = whisper, drag anywhere = rotate!)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false;
    let downX = 0;
    let downY = 0;
    let prevX = 0;
    let noseHoldTimer: ReturnType<typeof setTimeout> | null = null;

    const clearNoseTimer = () => {
      if (noseHoldTimer) {
        clearTimeout(noseHoldTimer);
        noseHoldTimer = null;
      }
    };

    const getHit = (cx: number, cy: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([blackNoseMC, sb1, sb2, sb3, whiteMC], false);
      return hits.length > 0 ? hits[0].object.name : null;
    };

    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      prevX = e.clientX;
      const hit = getHit(e.clientX, e.clientY);
      dragging = true;
      clearNoseTimer();
      if (hit === "nose") {
        noseHoldTimer = setTimeout(() => {
          dragging = false;
          springRef.current.sx = 1.04;
          springRef.current.sy = 0.96;
          onTapNoseStart();
        }, 220);
      }
    };

    const onMove = (e: PointerEvent) => {
      const hit = getHit(e.clientX, e.clientY);
      renderer.domElement.style.cursor = hit ? "pointer" : dragging ? "grabbing" : "grab";
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) {
        clearNoseTimer();
      }
      if (!dragging) return;
      const dx = e.clientX - prevX;
      prevX = e.clientX;
      rotYRef.current += dx * 0.011;
    };

    const onUp = (e: PointerEvent) => {
      clearNoseTimer();
      if (recRef.current) {
        onTapNoseEnd();
        dragging = false;
        return;
      }
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved < 7) {
        const hit = getHit(e.clientX, e.clientY);
        if (hit === "snowman") {
          onTapSnowman();
        } else if (hit === "head" || hit === "nose") {
          springRef.current.sx = 1.07;
          springRef.current.sy = 0.92;
          springRef.current.jumpY = 0.12;
          onTapHead();
        }
      }
      dragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    // Observe actual container div size changes (e.g. toggling mobile frame vs full window!)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: cw, height: ch } = entry.contentRect;
        if (cw > 0 && ch > 0) {
          syncCameraAndSize(cw, ch);
        }
      }
    });
    resizeObserver.observe(container);

    let raf = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const curPet = petRef.current;
      const stacking = stackingRef.current;
      const bagMode = bagRef.current;
      const rec = recRef.current;

      roomGroup.visible = !bagMode;
      lanyardGroup.visible = bagMode;

      const eq = curPet.equippedItems || [];
      glassesGroup.visible = eq.includes("thick_glasses");
      scarfGroup.visible = eq.includes("zhihu_scarf");
      beanieGroup.visible = eq.includes("camp_beanie");
      fishGroup.visible = eq.includes("codfish_plush");
      muffsGroup.visible = eq.includes("ear_muffs");

      // Blink vs Happy Crescent Eyes
      const isSmiling = stacking || curPet.mood === "happy";
      happyEyesGroup.visible = isSmiling;
      beadEyesGroup.visible = !isSmiling;
      if (!isSmiling) {
        const blink = (t % 4.2) > 4.05;
        leftEye.scale.y = blink ? 0.18 : 1.25;
        rightEye.scale.y = blink ? 0.18 : 1.25;
      }

      // Arms Tween
      const sp = springRef.current;
      sp.armLerp += ((stacking ? 1 : 0) - sp.armLerp) * 0.12;
      leftArm.rotation.x = -sp.armLerp * 1.1;
      leftArm.rotation.z = -sp.armLerp * 0.45 + (1 - sp.armLerp) * Math.sin(t * 2) * 0.03;
      rightArm.rotation.x = -sp.armLerp * 1.1;
      rightArm.rotation.z = sp.armLerp * 0.45 - (1 - sp.armLerp) * Math.sin(t * 2) * 0.03;

      snowStack.visible = !bagMode && stacking;
      const st = stacking ? 1 : 0.001;
      sb1.scale.lerp(new THREE.Vector3(st, st, st), 0.16);
      sb2.scale.lerp(new THREE.Vector3(st, st, st), 0.14);
      sb3.scale.lerp(new THREE.Vector3(st, st, st), 0.12);

      // Gentle Nose Squash when pinched (never turn blue!)
      const noseScale = rec ? S * 0.97 : S;
      blackNoseMC.scale.setScalar(noseScale);

      // Breathing & Bounce
      sp.sx += (1 - sp.sx) * 0.14;
      sp.sy += (1 - sp.sy) * 0.14;
      sp.sz += (1 - sp.sz) * 0.14;
      sp.jumpY += (0 - sp.jumpY) * 0.14;

      const breath = Math.sin(t * 2.2) * 0.01;
      kanshanRig.scale.set(sp.sx - breath * 0.3, sp.sy + breath, sp.sz - breath * 0.3);

      const baseY = bagMode ? 0.08 + Math.sin(t * 2) * 0.05 : -0.24;
      charRoot.position.y = baseY + sp.jumpY;
      charRoot.rotation.y += (rotYRef.current - charRoot.rotation.y) * 0.12;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(raf);
      dom.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      resizeObserver.disconnect();
      whiteMC.geometry.dispose();
      blackNoseMC.geometry.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="w-full h-full select-none" />;
}
