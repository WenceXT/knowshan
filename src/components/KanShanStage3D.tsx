"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { PetState } from "@/types/knowshan";
import {
  buildContouredKnittedScarf,
  buildCuteCodfish,
  buildDetailedGlasses,
  buildKnittedBeanie,
  buildPlushEarmuffs,
  buildSmoothSDFMesh,
  evalCartoonKanshanSDF,
  findFaceSurfaceZ,
  findSurfaceX,
} from "@/lib/kanshan3d-builder";

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

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function smax(a: number, b: number, k: number): number {
  return -smin(-a, -b, k);
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
  return Math.hypot(px - cx, py - cy, pz - cz) - r;
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
  const rotYRef = useRef(-0.18);

  useEffect(() => {
    petRef.current = pet;
    springRef.current.sx = 1.06;
    springRef.current.sy = 0.94;
    springRef.current.sz = 1.06;
    springRef.current.jumpY = 0.09;
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

    const width = container.clientWidth || 420;
    const height = container.clientHeight || 860;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(23, width / height, 0.1, 100);

    const syncCameraAndSize = (w: number, h: number) => {
      if (w <= 0 || h <= 0) return;
      const aspect = w / h;
      camera.aspect = aspect;
      const extraZ = aspect < 0.72 ? (0.72 - aspect) * 6.2 : 0;
      camera.position.set(0, 0.36, 9.4 + extraZ);
      camera.lookAt(0, -0.18, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    syncCameraAndSize(width, height);

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // =========================================================
    // BLIND-BOX SOFT TOON-VINYL LIGHTING (Warm highlights, sky-tinted shadows, zero grey mud!)
    // =========================================================
    const hemiLight = new THREE.HemisphereLight(0xfffefa, 0xdbeafe, 1.68);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffdf9, 1.05);
    keyLight.position.set(-2.8, 6.2, 5.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.radius = 5;
    scene.add(keyLight);

    // Frontal fill light keeps cartoon white belly bright & creamy
    const frontFill = new THREE.DirectionalLight(0xf0f7ff, 0.45);
    frontFill.position.set(1.5, 0.5, 5.5);
    scene.add(frontFill);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.55);
    rimLight.position.set(3.5, 3.0, -3.5);
    scene.add(rimLight);

    // =========================================================
    // 1. ARCTIC ROOM PROPS: SHELL SOFA + GIANT PAW RUG
    // =========================================================
    const roomGroup = new THREE.Group();
    scene.add(roomGroup);

    const floorShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.ShadowMaterial({ opacity: 0.11 })
    );
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.position.y = -1.42;
    floorShadow.receiveShadow = true;
    roomGroup.add(floorShadow);

    // Plush Shell Sofa
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(-1.32, -1.4, -1.55);
    sofaGroup.rotation.y = 0.36;
    const sofaBlue = new THREE.MeshStandardMaterial({ color: 0xb4d3f2, roughness: 0.92 });
    const sofaFrost = new THREE.MeshStandardMaterial({ color: 0xdcf0ff, roughness: 0.94 });

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
        new THREE.CapsuleGeometry(0.26, h * 0.52, 12, 20),
        idx % 2 === 0 ? sofaBlue : sofaFrost
      );
      petal.position.set(Math.sin(ang) * 0.9, 0.64 + h * 0.15, -0.42 - Math.cos(ang) * 0.16);
      petal.rotation.z = -ang * 0.4;
      petal.rotation.x = -0.12;
      sofaGroup.add(petal);
    });
    roomGroup.add(sofaGroup);

    // Giant Blue & White Paw Rug
    const pawRug = new THREE.Group();
    pawRug.position.set(0, -1.41, 0.08);
    const rugBlue = new THREE.MeshStandardMaterial({ color: 0x8cc0f6, roughness: 0.94 });
    const rugWhite = new THREE.MeshStandardMaterial({ color: 0xfafcff, roughness: 0.96 });

    const padB = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.6, 0.055, 48), rugBlue);
    padB.scale.set(1.26, 1, 0.78);
    padB.position.set(0, 0.028, 0.15);
    padB.receiveShadow = true;
    const padW = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.28, 0.068, 48), rugWhite);
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
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.56, 0.054, 28), rugBlue);
      bt.scale.set(1.04, 1, 0.82);
      bt.position.set(t.x, 0.027, t.z);
      bt.rotation.y = t.r;
      bt.receiveShadow = true;
      const wt = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.37, 0.066, 28), rugWhite);
      wt.position.set(t.x * 0.96, 0.033, t.z * 0.96);
      wt.rotation.y = t.r;
      wt.receiveShadow = true;
      pawRug.add(bt, wt);
    });
    roomGroup.add(pawRug);

    // =========================================================
    // 2. CARTOON Q-VERSION BLIND-BOX LIU KANSHAN
    // =========================================================
    const charRoot = new THREE.Group();
    charRoot.position.set(0, -0.25, 0.12);
    scene.add(charRoot);

    const S = 1.38;

    // Bag Charm Lanyard
    const lanyardGroup = new THREE.Group();
    const strap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.82, 16),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.55 })
    );
    strap.position.set(0, 1.25, -0.02);
    const clasp = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.036, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.18 })
    );
    clasp.position.set(0, 1.72, -0.02);
    lanyardGroup.add(strap, clasp);
    charRoot.add(lanyardGroup);

    const kanshanRig = new THREE.Group();
    charRoot.add(kanshanRig);

    // Soft Matte-Velvet Vinyl Materials (Cartoon Designer Toy Finish!)
    const vinylWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.68,
      metalness: 0.0,
      emissive: 0xf4f8ff,
      emissiveIntensity: 0.12, // Subtle subsurface warmth prevents grey shadows!
    });
    const limbCharcoalMat = new THREE.MeshStandardMaterial({
      color: 0x23262e,
      roughness: 0.55,
      metalness: 0.03,
    });
    const noseBeanMat = new THREE.MeshStandardMaterial({
      color: 0x1d2027,
      roughness: 0.36,
      metalness: 0.06,
    });
    const eyeBeadMat = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      roughness: 0.22,
      metalness: 0.08,
    });
    const blushMat = new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      roughness: 0.85,
      transparent: true,
      opacity: 0.32,
    });

    // A) Silky Analytical-Normal UNCUT White Body + Plump Ears + Fluffy Tail (zero black belly bleed!)
    const whiteBodyMesh = buildSmoothSDFMesh(76, vinylWhiteMat, (x, y, z) => {
      const dBody = evalCartoonKanshanSDF(x, y, z);
      const dTail = sdSphere(x, y, z, 0, -0.35, -0.41, 0.135);
      return smin(dBody, dTail, 0.042);
    });
    whiteBodyMesh.scale.setScalar(S);
    whiteBodyMesh.castShadow = true;
    whiteBodyMesh.receiveShadow = true;
    whiteBodyMesh.name = "head";
    kanshanRig.add(whiteBodyMesh);

    // B) Crisp, Self-Contained Plump Cartoon Oval Black Nose Bean nestled on the muzzle tip!
    const blackNoseMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 36),
      noseBeanMat
    );
    blackNoseMesh.scale.set(0.175 * S, 0.120 * S, 0.132 * S);
    blackNoseMesh.position.set(0, 0.198 * S, 0.448 * S);
    blackNoseMesh.rotation.x = 0.06;
    blackNoseMesh.castShadow = true;
    blackNoseMesh.name = "nose";
    kanshanRig.add(blackNoseMesh);

    // Subtle Inner Ear Soft Blush & Cheek Blush Pads for Extra Cartoon Charm!
    [-1, 1].forEach((side) => {
      const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.18, 16), blushMat);
      innerEar.scale.set(1, 1, 0.28);
      innerEar.position.set(side * 0.19 * S, 0.45 * S, 0.045 * S);
      innerEar.rotation.z = -side * 0.12;
      kanshanRig.add(innerEar);
    });

    // C) Forward-Facing Expressive Cartoon Bead Eyes (centered inside glasses & visible in 3/4!)
    const eyeX = 0.212;
    const eyeY = 0.252;
    const eyeZ = findFaceSurfaceZ(eyeX, eyeY);
    const eyeSurfX = eyeX;

    const beadEyesGroup = new THREE.Group();
    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const createBeadEye = (side: number) => {
      const eg = new THREE.Group();
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 20), eyeBeadMat);
      bead.scale.set(0.95, 1.15, 0.85);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 10), catchlightMat);
      glint.position.set(-side * 0.008, 0.014, 0.030);
      eg.add(bead, glint);
      eg.position.set(side * eyeX * S, eyeY * S, (eyeZ + 0.004) * S);
      eg.rotation.y = side * 0.24;
      return eg;
    };
    const leftEye = createBeadEye(-1);
    const rightEye = createBeadEye(1);
    beadEyesGroup.add(leftEye, rightEye);
    kanshanRig.add(beadEyesGroup);

    const happyEyesGroup = new THREE.Group();
    const arcGeo = new THREE.TorusGeometry(0.042, 0.013, 12, 24, Math.PI * 0.85);
    [-1, 1].forEach((side) => {
      const smile = new THREE.Mesh(arcGeo, eyeBeadMat);
      smile.position.set(side * eyeX * S, (eyeY - 0.008) * S, (eyeZ + 0.012) * S);
      smile.rotation.set(0.06, side * 0.26, Math.PI * 0.08);
      happyEyesGroup.add(smile);
    });
    happyEyesGroup.visible = false;
    kanshanRig.add(happyEyesGroup);

    // D) Cute Chubby Cartoon Standing Legs + Plump Rounded Shoes
    [-1, 1].forEach((side) => {
      const g = new THREE.Group();
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.082, 0.078, 0.48, 24),
        limbCharcoalMat
      );
      leg.position.set(side * 0.21, -0.91, 0.0);
      leg.castShadow = true;

      const boot = new THREE.Mesh(
        new THREE.SphereGeometry(0.105, 22, 18),
        limbCharcoalMat
      );
      boot.scale.set(0.96, 0.72, 1.38);
      boot.position.set(side * 0.21, -1.13, 0.055);
      boot.castShadow = true;

      g.add(leg, boot);
      kanshanRig.add(g);
    });

    // E) Chubby Cartoon Arms + Cute Plump Mitten Paws (Designed to HUG the snowman!)
    const armY = -0.14;
    const armZ = 0.02;
    const shoulderSurfX = findSurfaceX(armY, armZ);

    const createCartoonArm = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (shoulderSurfX - 0.045) * S, armY * S, armZ * S);

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.11, -0.17, 0.02),
        new THREE.Vector3(side * 0.085, -0.36, 0.06),
      ]);
      const armMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 22, 0.056, 18, false),
        limbCharcoalMat
      );
      armMesh.castShadow = true;

      // Cute plump rounded paw + little thumb!
      const pawGroup = new THREE.Group();
      pawGroup.position.set(side * 0.085, -0.36, 0.06);
      const mitten = new THREE.Mesh(new THREE.SphereGeometry(0.066, 18, 18), limbCharcoalMat);
      mitten.scale.set(0.92, 1.15, 0.88);
      const thumb = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.026, 0.045, 8, 12),
        limbCharcoalMat
      );
      thumb.position.set(-side * 0.045, 0.01, 0.04);
      thumb.rotation.z = side * 0.5;
      thumb.rotation.x = -0.4;

      pawGroup.add(mitten, thumb);
      pivot.add(armMesh, pawGroup);
      return pivot;
    };
    const leftArm = createCartoonArm(-1);
    const rightArm = createCartoonArm(1);
    kanshanRig.add(leftArm, rightArm);

    // =========================================================
    // 3. DETAILED CUTE SNOWMAN RIGHT IN KANSHAN'S PAWS!
    // =========================================================
    // Attached inside `kanshanRig` so when you rotate KanShan 360°, it rotates TOGETHER with KanShan's paws!
    const snowStack = new THREE.Group();
    snowStack.position.set(0, -1.08, 0.62);
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      emissive: 0xf0f7ff,
      emissiveIntensity: 0.1,
    });

    const sb1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), snowMat);
    sb1.scale.set(1.08, 0.92, 1.08);
    sb1.position.set(0, 0.16, 0);
    sb1.castShadow = true;
    sb1.name = "snowman";

    const sb2 = new THREE.Mesh(new THREE.SphereGeometry(0.175, 24, 24), snowMat);
    sb2.scale.set(1.05, 0.94, 1.05);
    sb2.position.set(0, 0.46, -0.02);
    sb2.castShadow = true;
    sb2.name = "snowman";

    // Cute tiny coal buttons on middle snowball
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), eyeBeadMat);
    b1.position.set(0, 0.50, 0.15);
    const b2 = b1.clone();
    b2.position.set(0, 0.42, 0.155);

    const sb3 = new THREE.Mesh(new THREE.SphereGeometry(0.145, 24, 24), snowMat);
    sb3.position.set(0, 0.72, -0.04);
    sb3.castShadow = true;
    sb3.name = "snowman";

    // Cute Snowman Face (Coal Eyes + Mini Carrot Nose!)
    const smEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), eyeBeadMat);
    smEyeL.position.set(-0.048, 0.745, 0.095);
    const smEyeR = smEyeL.clone();
    smEyeR.position.x = 0.048;

    const carrotNose = new THREE.Mesh(
      new THREE.ConeGeometry(0.024, 0.09, 14),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 })
    );
    carrotNose.rotation.x = Math.PI / 2;
    carrotNose.position.set(0, 0.72, 0.135);

    snowStack.add(sb1, sb2, b1, b2, sb3, smEyeL, smEyeR, carrotNose);
    kanshanRig.add(snowStack);

    // =========================================================
    // 4. DESIGNER-TOY SCULPTED ACCESSORIES
    // =========================================================
    const glassesGroup = buildDetailedGlasses(S, eyeY, eyeZ, eyeSurfX);
    kanshanRig.add(glassesGroup);

    const scarfGroup = buildContouredKnittedScarf(S);
    kanshanRig.add(scarfGroup);

    const beanieGroup = buildKnittedBeanie(S);
    kanshanRig.add(beanieGroup);

    const muffsGroup = buildPlushEarmuffs(S);
    kanshanRig.add(muffsGroup);

    const fishGroup = buildCuteCodfish();
    fishGroup.position.set(0.66, -0.56, 0.18);
    fishGroup.rotation.z = -0.35;
    kanshanRig.add(fishGroup);

    // =========================================================
    // 5. RAYCASTER & SMOOTH 360° TURNTABLE DRAG
    // =========================================================
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
      const hits = raycaster.intersectObjects(
        [blackNoseMesh, sb1, sb2, sb3, whiteBodyMesh],
        false
      );
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
          springRef.current.jumpY = 0.11;
          onTapHead();
        }
      }
      dragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: cw, height: ch } = entry.contentRect;
        if (cw > 0 && ch > 0) syncCameraAndSize(cw, ch);
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
      fishGroup.visible = eq.includes("codfish_plush") && !stacking;
      muffsGroup.visible = eq.includes("ear_muffs");

      // Blink vs Happy Eyes
      const isSmiling = stacking || curPet.mood === "happy";
      happyEyesGroup.visible = isSmiling;
      beadEyesGroup.visible = !isSmiling;
      if (!isSmiling) {
        const blink = (t % 4.2) > 4.05;
        leftEye.scale.y = blink ? 0.16 : 1.0;
        rightEye.scale.y = blink ? 0.16 : 1.0;
      }

      // Arms Tween: Slide forward & curve inward so paws physically TOUCH & HUG the snowman!
      const sp = springRef.current;
      sp.armLerp += ((stacking ? 1 : 0) - sp.armLerp) * 0.12;
      const idleX = (shoulderSurfX - 0.045) * S;
      const hugX = 0.34 * S;
      const curArmY = (armY - sp.armLerp * 0.12) * S;
      const curArmZ = (armZ + sp.armLerp * 0.24) * S;

      leftArm.position.set(-(idleX + (hugX - idleX) * sp.armLerp), curArmY, curArmZ);
      rightArm.position.set(idleX + (hugX - idleX) * sp.armLerp, curArmY, curArmZ);

      leftArm.rotation.x = -sp.armLerp * 1.05;
      leftArm.rotation.y = sp.armLerp * 0.45;
      leftArm.rotation.z = sp.armLerp * 0.48 + (1 - sp.armLerp) * Math.sin(t * 2) * 0.03;

      rightArm.rotation.x = -sp.armLerp * 1.05;
      rightArm.rotation.y = -sp.armLerp * 0.45;
      rightArm.rotation.z = -sp.armLerp * 0.48 - (1 - sp.armLerp) * Math.sin(t * 2) * 0.03;

      snowStack.visible = !bagMode && (stacking || sp.armLerp > 0.08);
      const sScale = stacking ? 1.06 : 0.001;
      snowStack.scale.lerp(new THREE.Vector3(sScale, sScale, sScale), 0.15);

      const nScale = rec ? 0.94 : 1.0;
      blackNoseMesh.scale.set(0.175 * S * nScale, 0.120 * S * nScale, 0.132 * S * nScale);

      // Breathing & Jelly Bounce
      sp.sx += (1 - sp.sx) * 0.14;
      sp.sy += (1 - sp.sy) * 0.14;
      sp.sz += (1 - sp.sz) * 0.14;
      sp.jumpY += (0 - sp.jumpY) * 0.14;

      const breath = Math.sin(t * 2.2) * 0.01;
      kanshanRig.scale.set(sp.sx - breath * 0.3, sp.sy + breath, sp.sz - breath * 0.3);

      const baseY = bagMode ? 0.06 + Math.sin(t * 2) * 0.05 : -0.25;
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
      whiteBodyMesh.geometry.dispose();
      blackNoseMesh.geometry.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="w-full h-full select-none" />;
}
