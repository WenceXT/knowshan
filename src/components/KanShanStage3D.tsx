"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { HoardedItem, PetState } from "@/types/knowshan";
import {
  buildContouredKnittedScarf,
  buildCuteCodfish,
  buildDetailedGlasses,
  buildFourFingeredArm,
  buildKnittedBeanie,
  buildPlushEarmuffs,
  buildSmoothSDFMesh,
  buildSparklingRoomTreasure,
  buildStandingLeg,
  evalCartoonKanshanSDF,
  findFaceSurfaceZ,
} from "@/lib/kanshan3d-builder";

interface KanShanStage3DProps {
  pet: PetState;
  hoardedItems: HoardedItem[];
  isHuntingTreasure: boolean;
  isRecordingNose: boolean;
  onTapHead: () => void;
  onTapNoseStart: () => void;
  onTapNoseEnd: () => void;
  onTapSnowman: () => void;
  onSelectHoardItem: (item: HoardedItem) => void;
}

// Grounded surface heights: white paw rug top = -1.276, sofa cushion top at (-0.88, -1.24) = -0.738
const TREASURE_SPOTS: [number, number, number][] = [
  [-0.08, -1.274, 0.88], // Foreground rug (cleanly in front of standing boots!)
  [0.64, -1.274, 0.66], // Right-front rug (cleanly to the right of standing Kanshan!)
  [-0.88, -0.738, -1.24], // Sofa cushion top (strictly above cushion surface — zero sinking!)
];

export default function KanShanStage3D({
  pet,
  hoardedItems,
  isHuntingTreasure,
  isRecordingNose,
  onTapHead,
  onTapNoseStart,
  onTapNoseEnd,
  onTapSnowman,
  onSelectHoardItem,
}: KanShanStage3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const petRef = useRef(pet);
  const hoardRef = useRef(hoardedItems);
  const huntingRef = useRef(isHuntingTreasure);
  const recRef = useRef(isRecordingNose);
  const onSelectHoardRef = useRef(onSelectHoardItem);

  const springRef = useRef({
    sx: 1,
    sy: 1,
    sz: 1,
    jumpY: 0,
    armLerp: 0,
    waveTimer: 0,
    patBoost: 1.8,
    treasureScale: 1,
    ambientSnowTime: 0,
    sb2Scale: 0,
    sb3Scale: 0,
    userRotatedTimer: 0,
  });
  // Default 3/4 angle showing off the iconic upturned fox snout & round white tail (like Photos 3 & 4!)
  const rotYRef = useRef(0.32);
  const rebuildTreasuresRef = useRef<((items: HoardedItem[]) => void) | null>(null);

  useEffect(() => {
    onSelectHoardRef.current = onSelectHoardItem;
  }, [onSelectHoardItem]);

  useEffect(() => {
    petRef.current = pet;
    springRef.current.sx = 1.05;
    springRef.current.sy = 0.95;
    springRef.current.sz = 1.05;
    springRef.current.jumpY = 0.07;
  }, [pet.equippedItems, pet.mood]);

  useEffect(() => {
    petRef.current = pet;
    springRef.current.patBoost = 2.8;
    if ((pet.snowballProgress || 20) <= 18) {
      springRef.current.ambientSnowTime = 0;
    }
  }, [pet.snowballProgress]);

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    hoardRef.current = hoardedItems;
    springRef.current.treasureScale = 0.05;
    rebuildTreasuresRef.current?.(hoardedItems);
  }, [hoardedItems]);

  useEffect(() => {
    huntingRef.current = isHuntingTreasure;
    if (isHuntingTreasure) {
      springRef.current.jumpY = 0.26;
      springRef.current.waveTimer = 1.4;
    }
  }, [isHuntingTreasure]);

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
      const extraZ = aspect < 0.72 ? (0.72 - aspect) * 7.5 : 0;
      camera.position.set(0, 0.18, 7.35 + extraZ);
      camera.lookAt(0, -0.44, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.07;

    syncCameraAndSize(width, height);

    container.innerHTML = "";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    // =========================================================
    // SOFT PASTEL STUDIO LIGHTING
    // =========================================================
    scene.add(new THREE.AmbientLight(0xf6faff, 1.48));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbe0f8, 0.92));

    const sunLight = new THREE.DirectionalLight(0xfffcf5, 0.98);
    sunLight.position.set(2.8, 5.2, 4.6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.radius = 6;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 0.58);
    rimLight.position.set(-3.2, 2.2, -2.5);
    scene.add(rimLight);

    // =========================================================
    // 1. ARCTIC ICE ROOM ENVIRONMENT
    // =========================================================
    const roomGroup = new THREE.Group();
    scene.add(roomGroup);

    const floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 8.5, 0.3, 64),
      new THREE.MeshStandardMaterial({
        color: 0xcbe2fa,
        roughness: 0.82,
        metalness: 0.02,
      })
    );
    floorMesh.position.set(0, -1.53, -0.5);
    floorMesh.receiveShadow = true;
    roomGroup.add(floorMesh);

    const iceSheen = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 48),
      new THREE.MeshStandardMaterial({
        color: 0xe6f2fe,
        roughness: 0.65,
        transparent: true,
        opacity: 0.65,
      })
    );
    iceSheen.rotation.x = -Math.PI / 2;
    iceSheen.scale.set(0.85, 1.35, 1);
    iceSheen.position.set(0, -1.378, 1.25);
    roomGroup.add(iceSheen);

    // Plush Shell Sofa in Back-Left
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(-1.26, -1.36, -1.45);
    sofaGroup.rotation.y = 0.36;
    const sofaBlue = new THREE.MeshStandardMaterial({ color: 0xb2d2f2, roughness: 0.93 });
    const sofaFrost = new THREE.MeshStandardMaterial({ color: 0xdcf0ff, roughness: 0.95 });

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

    // Thick Puffy Blue & White Paw Rug (Top surface at Y = -1.278)
    const pawRug = new THREE.Group();
    pawRug.position.set(0, -1.37, 0.12);
    const rugBlue = new THREE.MeshStandardMaterial({ color: 0x8bc0f7, roughness: 0.95 });
    const rugWhite = new THREE.MeshStandardMaterial({ color: 0xfbfdff, roughness: 0.96 });

    const padB = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.58, 0.075, 48), rugBlue);
    padB.scale.set(1.26, 1, 0.78);
    padB.position.set(0, 0.038, 0.15);
    padB.receiveShadow = true;
    const padW = new THREE.Mesh(new THREE.CylinderGeometry(1.20, 1.24, 0.092, 48), rugWhite);
    padW.scale.set(1.2, 1, 0.74);
    padW.position.set(0, 0.046, 0.17);
    padW.receiveShadow = true;
    pawRug.add(padB, padW);

    [
      { x: -1.64, z: -0.2, r: 0.34 },
      { x: -0.66, z: -0.78, r: 0.12 },
      { x: 0.66, z: -0.78, r: -0.12 },
      { x: 1.64, z: -0.2, r: -0.34 },
    ].forEach((t) => {
      const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.55, 0.072, 28), rugBlue);
      bt.scale.set(1.04, 1, 0.82);
      bt.position.set(t.x, 0.036, t.z);
      bt.rotation.y = t.r;
      bt.receiveShadow = true;
      const wt = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.36, 0.088, 28), rugWhite);
      wt.position.set(t.x * 0.96, 0.044, t.z * 0.96);
      wt.rotation.y = t.r;
      wt.receiveShadow = true;
      pawRug.add(bt, wt);
    });
    roomGroup.add(pawRug);

    // =========================================================
    // 1.5 SUBTLE GROUNDED ROOM TREASURES (Directly Clickable!)
    // =========================================================
    const treasuresGroup = new THREE.Group();
    roomGroup.add(treasuresGroup);

    let activePods: ReturnType<typeof buildSparklingRoomTreasure>[] = [];
    let treasureHitMeshes: THREE.Mesh[] = [];

    const rebuildTreasures = (items: HoardedItem[]) => {
      while (treasuresGroup.children.length > 0) {
        treasuresGroup.remove(treasuresGroup.children[0]);
      }
      activePods = [];
      treasureHitMeshes = [];

      items.slice(0, 3).forEach((item, idx) => {
        const pod = buildSparklingRoomTreasure(item.emoji, idx);
        const [tx, ty, tz] = TREASURE_SPOTS[idx] || TREASURE_SPOTS[0];
        pod.root.position.set(tx, ty, tz);
        treasuresGroup.add(pod.root);
        activePods.push(pod);
        treasureHitMeshes.push(pod.hitMesh);
      });
    };

    rebuildTreasuresRef.current = rebuildTreasures;
    rebuildTreasures(hoardRef.current);

    // =========================================================
    // 2. BIGGER PROGRESSIVE 1 -> 2 -> 3 SNOWBALLS ON RUG!
    // =========================================================
    const snowStack = new THREE.Group();
    snowStack.position.set(-0.56, -1.276, 0.28);
    roomGroup.add(snowStack);

    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      emissive: 0xf0f7ff,
      emissiveIntensity: 0.14,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x181d26,
      roughness: 0.32,
      metalness: 0.04,
    });

    // Ball 1: Generous plump base snowball (starts as 1 single snowball!)
    const sb1 = new THREE.Mesh(new THREE.SphereGeometry(0.195, 28, 24), snowMat);
    sb1.scale.set(1.08, 0.9, 1.08);
    sb1.position.set(0, 0.165, 0);
    sb1.castShadow = true;
    sb1.receiveShadow = true;
    sb1.name = "snowman";

    // Ball 2: Plump middle snowball
    const sb2 = new THREE.Mesh(new THREE.SphereGeometry(0.152, 26, 22), snowMat);
    sb2.position.set(0, 0.425, 0);
    sb2.castShadow = true;
    sb2.visible = false;
    sb2.name = "snowman";

    // Ball 3: Top head snowball with pebble eyes
    const sb3Group = new THREE.Group();
    sb3Group.position.set(0, 0.645, 0);
    sb3Group.visible = false;

    const sb3 = new THREE.Mesh(new THREE.SphereGeometry(0.118, 24, 20), snowMat);
    sb3.castShadow = true;
    sb3.name = "snowman";
    sb3Group.add(sb3);

    [-1, 1].forEach((side) => {
      const pebbleEye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12), pupilMat);
      pebbleEye.position.set(side * 0.038, 0.014, 0.112);
      sb3Group.add(pebbleEye);
    });

    snowStack.add(sb1, sb2, sb3Group);

    // =========================================================
    // 3. PHOTO-ACCURATE STANDING LIU KANSHAN (Photos 1–4!)
    // =========================================================
    const S = 0.86;
    const baseCharX = 0.11;
    // Boot sole is at local y = (-0.455 - 0.285 - 0.056) * S = -0.796 * S; rug top is -1.276!
    const baseCharY = -1.276 + 0.796 * S;

    const charRoot = new THREE.Group();
    charRoot.position.set(baseCharX, baseCharY, 0.20);
    charRoot.rotation.y = rotYRef.current;
    scene.add(charRoot);

    const kanshanRig = new THREE.Group();
    charRoot.add(kanshanRig);

    const vinylWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.74,
      metalness: 0.0,
      emissive: 0xf4f8ff,
      emissiveIntensity: 0.1,
    });
    // Rich velvety charcoal-black matching Photos 1–4!
    const charcoalLimbMat = new THREE.MeshStandardMaterial({
      color: 0x20252f,
      roughness: 0.62,
      metalness: 0.03,
    });
    const noseCapMat = new THREE.MeshStandardMaterial({
      color: 0x1b2029,
      roughness: 0.48,
      metalness: 0.04,
    });

    // Standing Pear-Capsule Body + Upright Ears + Bold Upturned Conical Snout
    const whiteBodyMesh = buildSmoothSDFMesh(76, vinylWhiteMat, evalCartoonKanshanSDF);
    whiteBodyMesh.scale.setScalar(S);
    whiteBodyMesh.castShadow = true;
    whiteBodyMesh.receiveShadow = true;
    whiteBodyMesh.name = "head";
    kanshanRig.add(whiteBodyMesh);

    // Wagging Plump Round White Pom-Pom Tail at lower back (Photos 1, 3, 4!)
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.27 * S, -0.28 * S);
    const tailBall = new THREE.Mesh(new THREE.SphereGeometry(0.155 * S, 28, 24), vinylWhiteMat);
    tailBall.position.set(0, 0, -0.11 * S);
    tailBall.castShadow = true;
    tailPivot.add(tailBall);
    kanshanRig.add(tailPivot);

    // Seamless Dipped Charcoal-Black Nose Cap wrapping the upturned snout tip (Photos 1–4!)
    const blackNoseMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), noseCapMat);
    blackNoseMesh.scale.set(0.146 * S, 0.142 * S, 0.136 * S);
    blackNoseMesh.position.set(0, 0.318 * S, 0.495 * S);
    blackNoseMesh.rotation.x = -0.18;
    blackNoseMesh.castShadow = true;
    blackNoseMesh.name = "nose";
    kanshanRig.add(blackNoseMesh);

    // Crisp Vertical-Oval Glossy Bead Eyes beside the snout root (Photos 1–4!)
    const eyeX = 0.186;
    const eyeY = 0.338;
    const eyeZ = findFaceSurfaceZ(eyeX, eyeY);

    const beadEyesGroup = new THREE.Group();
    const createOvalBeadEye = (side: number) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.025 * S, 20, 20), pupilMat);
      dot.scale.set(0.88, 1.24, 0.72);
      dot.position.set(side * eyeX * S, eyeY * S, (eyeZ + 0.008) * S);
      dot.rotation.y = side * 0.38;
      return dot;
    };
    const leftEye = createOvalBeadEye(-1);
    const rightEye = createOvalBeadEye(1);
    beadEyesGroup.add(leftEye, rightEye);
    kanshanRig.add(beadEyesGroup);

    const happyEyesGroup = new THREE.Group();
    const arcGeo = new THREE.TorusGeometry(0.032 * S, 0.010 * S, 12, 24, Math.PI * 0.85);
    [-1, 1].forEach((side) => {
      const smile = new THREE.Mesh(arcGeo, pupilMat);
      smile.position.set(side * eyeX * S, (eyeY - 0.004) * S, (eyeZ + 0.012) * S);
      smile.rotation.set(0.04, side * 0.38, Math.PI * 0.08);
      happyEyesGroup.add(smile);
    });
    happyEyesGroup.visible = false;
    kanshanRig.add(happyEyesGroup);

    // Slender Charcoal-Black Arms with 4-Fingered Hands + Sturdy Standing Legs with Boots!
    const leftArm = buildFourFingeredArm(-1, S, charcoalLimbMat);
    const rightArm = buildFourFingeredArm(1, S, charcoalLimbMat);
    kanshanRig.add(leftArm, rightArm);

    const leftLeg = buildStandingLeg(-1, S, charcoalLimbMat);
    const rightLeg = buildStandingLeg(1, S, charcoalLimbMat);
    kanshanRig.add(leftLeg, rightLeg);

    // =========================================================
    // 4. FITTED OPTIONAL ACCESSORIES (Wardrobe)
    // =========================================================
    const glassesGroup = buildDetailedGlasses(S, eyeY);
    kanshanRig.add(glassesGroup);

    const scarfGroup = buildContouredKnittedScarf(S);
    kanshanRig.add(scarfGroup);

    const beanieGroup = buildKnittedBeanie(S);
    kanshanRig.add(beanieGroup);

    const muffsGroup = buildPlushEarmuffs(S);
    kanshanRig.add(muffsGroup);

    const fishGroup = buildCuteCodfish();
    fishGroup.scale.setScalar(0.72 * S);
    fishGroup.position.set(0.06 * S, -0.35 * S, 0.09 * S);
    fishGroup.rotation.z = -0.35;
    rightArm.add(fishGroup);

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

      const treasureHits = raycaster.intersectObjects(treasureHitMeshes, false);
      if (treasureHits.length > 0) return treasureHits[0].object.name;

      const snowTargets: THREE.Object3D[] = [sb1];
      if (sb2.visible) snowTargets.push(sb2);
      if (sb3Group.visible) snowTargets.push(sb3);
      const hits = raycaster.intersectObjects(
        [blackNoseMesh, ...snowTargets, whiteBodyMesh],
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
      if (Math.abs(dx) > 0.5) {
        rotYRef.current += dx * 0.012;
        springRef.current.userRotatedTimer = 5.0;
      }
    };

    const onUp = (e: PointerEvent) => {
      clearNoseTimer();
      if (recRef.current) {
        onTapNoseEnd();
        dragging = false;
        return;
      }
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved < 8) {
        const hit = getHit(e.clientX, e.clientY);
        if (hit && hit.startsWith("hoard_")) {
          const idx = Number(hit.split("_")[1]);
          const item = hoardRef.current[idx];
          if (item) onSelectHoardRef.current(item);
        } else if (hit === "snowman") {
          onTapSnowman();
        } else if (hit === "head" || hit === "nose") {
          springRef.current.sx = 1.07;
          springRef.current.sy = 0.93;
          springRef.current.jumpY = 0.11;
          springRef.current.waveTimer = 1.8;
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

    // =========================================================
    // 6. RICH 5-BEHAVIOR IDLE CHOREOGRAPHER + PROGRESSIVE SNOWBALLS
    // =========================================================
    let raf = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;
      const curPet = petRef.current;
      const hunting = huntingRef.current;
      const rec = recRef.current;

      const sp = springRef.current;
      if (sp.patBoost > 0) sp.patBoost = Math.max(0, sp.patBoost - dt);
      if (sp.waveTimer > 0) sp.waveTimer = Math.max(0, sp.waveTimer - dt);
      if (sp.userRotatedTimer > 0) sp.userRotatedTimer = Math.max(0, sp.userRotatedTimer - dt);

      // Progressive 1 -> 2 -> 3 snowball build-up (~10s for 2nd ball, ~21s for 3rd ball!)
      sp.ambientSnowTime = Math.min(30, sp.ambientSnowTime + dt);
      const effectiveSnow = Math.min(
        100,
        (curPet.snowballProgress || 20) + sp.ambientSnowTime * 2.8
      );
      const snowTier = effectiveSnow >= 80 ? 3 : effectiveSnow >= 48 ? 2 : 1;

      sp.treasureScale += (1 - sp.treasureScale) * 0.12;
      treasuresGroup.scale.setScalar(sp.treasureScale);

      // Animate Subtle Grounded Room Treasures
      activePods.forEach((pod, idx) => {
        const phase = t * 2.1 + idx * 2.1;
        pod.propGroup.position.y = 0.01 + (Math.sin(phase) + 1) * 0.006;
        pod.propGroup.rotation.y = Math.sin(t * 0.8 + idx) * 0.2;

        const haloPulse = 0.94 + Math.sin(phase * 1.1) * 0.07;
        pod.haloMesh.scale.set(haloPulse, haloPulse, 1);

        pod.stars.forEach((star, sIdx) => {
          const spPhase = t * 3.6 + idx * 1.7 + sIdx * 2.1;
          const twinkle = Math.max(0.2, (Math.sin(spPhase) + 1) * 0.42);
          star.scale.setScalar(twinkle);
          star.rotation.z = t * 0.9 + sIdx;
          star.lookAt(camera.position);
        });
      });

      const eq = curPet.equippedItems || [];
      glassesGroup.visible = eq.includes("thick_glasses");
      scarfGroup.visible = eq.includes("zhihu_scarf");
      beanieGroup.visible = eq.includes("camp_beanie");
      fishGroup.visible = eq.includes("codfish_plush");
      muffsGroup.visible = eq.includes("ear_muffs");

      // ---------------------------------------------------------
      // 5-State Seamless Idle Choreographer (22-second loop):
      // [0.0..4.2s]  State A: Patting & shaping snowball beside him
      // [4.2..8.6s]  State B: Iconic 3/4 Sunset Pose + Snout Sniff & Tail Wag (Photo 3!)
      // [8.6..13.0s] State C: Happy Foot-Tap Step & Hip Sway (Photos 1 & 2!)
      // [13.0..17.2s] State D: Patting growing 2nd/3rd snowball
      // [17.2..22.0s] State E: Curious Head-Tilt + 4-Finger Hand Wave Hello (Photo 4!)
      // ---------------------------------------------------------
      const phase22 = t % 22.0;
      const isPatState =
        !hunting &&
        sp.waveTimer <= 0 &&
        (sp.patBoost > 0 || phase22 < 4.2 || (phase22 >= 13.0 && phase22 < 17.2));
      const isSniffState =
        !hunting && sp.waveTimer <= 0 && !isPatState && phase22 >= 4.2 && phase22 < 8.6;
      const isStepDanceState =
        !hunting && sp.waveTimer <= 0 && !isPatState && phase22 >= 8.6 && phase22 < 13.0;
      const isIdleWaveState =
        !hunting && sp.waveTimer <= 0 && !isPatState && phase22 >= 17.2;

      // Gently steer body orientation during idle (unless user dragged turntable recently!)
      if (!dragging && sp.userRotatedTimer <= 0) {
        const targetIdleYaw = isPatState
          ? -0.22
          : isSniffState
          ? 0.42
          : isStepDanceState
          ? 0.24 + Math.sin(t * 3.2) * 0.14
          : 0.30;
        // Smooth shortest-angle blend so 360° user spins don't unwind abruptly
        const diff =
          ((targetIdleYaw - rotYRef.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        rotYRef.current += diff * 0.04;
      }

      sp.armLerp += ((isPatState ? 1 : 0) - sp.armLerp) * 0.12;
      const patWave = Math.max(0, Math.sin(t * 8.2)) * sp.armLerp;

      const isSmiling =
        hunting ||
        curPet.mood === "happy" ||
        sp.waveTimer > 0 ||
        isStepDanceState ||
        sp.armLerp > 0.7;
      happyEyesGroup.visible = isSmiling;
      beadEyesGroup.visible = !isSmiling;
      if (!isSmiling) {
        // Occasional natural double-blink!
        const blinkCycle = t % 4.2;
        const blink =
          (blinkCycle > 3.7 && blinkCycle < 3.84) ||
          (isSniffState && blinkCycle > 3.92 && blinkCycle < 4.05);
        leftEye.scale.set(0.88, blink ? 0.14 : 1.24, 0.72);
        rightEye.scale.set(0.88, blink ? 0.14 : 1.24, 0.72);
      }

      // ---------------------------------------------------------
      // ARMS: Patting Snowball (strictly outside snow X!) / Waving (Photo 4!) / Step Swing
      // ---------------------------------------------------------
      const activeWave = sp.waveTimer > 0 || isIdleWaveState;

      if (hunting) {
        // Joyful running arms spread wide like Photo 2!
        leftArm.rotation.set(-0.4, 0, -1.85 + Math.sin(t * 14) * 0.25);
        rightArm.rotation.set(-0.4, 0, 1.85 - Math.sin(t * 14) * 0.25);
      } else if (activeWave) {
        // Photo 4 Friendly 4-Finger Hand Wave!
        leftArm.rotation.x = -0.25;
        leftArm.rotation.y = 0.15;
        leftArm.rotation.z = -2.28 + Math.sin(t * 11) * 0.24;

        rightArm.rotation.x = Math.sin(t * 2.0) * 0.05;
        rightArm.rotation.y = 0;
        rightArm.rotation.z = -0.06 - Math.sin(t * 1.8) * 0.03;
      } else if (isStepDanceState) {
        // Playful alternating arm swing like Photo 1!
        const swing = Math.sin(t * 6.4);
        leftArm.rotation.set(swing * 0.42, 0, -0.14);
        rightArm.rotation.set(-swing * 0.42, 0, 0.14);
      } else {
        // Snowball patting on left arm (stays strictly to the right of snow X <= -0.368 — ZERO overlap!)
        const targetRotX = snowTier === 1 ? -0.18 : snowTier === 2 ? -0.32 : -0.46;
        const targetRotZ = snowTier === 1 ? -0.26 : snowTier === 2 ? -0.32 : -0.36;
        leftArm.rotation.x =
          sp.armLerp * (targetRotX - patWave * 0.07) +
          (1 - sp.armLerp) * Math.sin(t * 1.9) * 0.04;
        leftArm.rotation.y = 0;
        leftArm.rotation.z =
          sp.armLerp * (targetRotZ - patWave * 0.04) +
          (1 - sp.armLerp) * (-0.05 + Math.sin(t * 1.8) * 0.025);

        rightArm.rotation.x = -Math.sin(t * 1.9) * 0.04;
        rightArm.rotation.y = 0;
        rightArm.rotation.z = 0.05 - Math.sin(t * 1.8) * 0.025;
      }

      // ---------------------------------------------------------
      // STANDING LEGS & BOOTS: Happy Foot-Tap / Running / Subtle Weight Shift
      // ---------------------------------------------------------
      let stepBobY = 0;
      let swayX = 0;
      if (hunting) {
        const run = Math.sin(t * 15);
        leftLeg.rotation.x = run * 0.65;
        rightLeg.rotation.x = -run * 0.65;
        stepBobY = Math.abs(Math.cos(t * 15)) * 0.14;
      } else if (isStepDanceState) {
        const step = Math.sin(t * 6.4);
        leftLeg.rotation.x = Math.max(0, step) * 0.34 - Math.max(0, -step) * 0.1;
        rightLeg.rotation.x = Math.max(0, -step) * 0.34 - Math.max(0, step) * 0.1;
        leftLeg.rotation.z = -0.03;
        rightLeg.rotation.z = 0.03;
        stepBobY = Math.abs(step) * 0.032;
        swayX = step * 0.028;
      } else {
        leftLeg.rotation.x += (0 - leftLeg.rotation.x) * 0.18;
        rightLeg.rotation.x += (0 - rightLeg.rotation.x) * 0.18;
        leftLeg.rotation.z += (0 - leftLeg.rotation.z) * 0.18;
        rightLeg.rotation.z += (0 - rightLeg.rotation.z) * 0.18;
      }

      // ---------------------------------------------------------
      // WAGGING POM-POM TAIL & SNIFFING NOSE TWITCH
      // ---------------------------------------------------------
      const tailSpeed = hunting || activeWave || isStepDanceState ? 11.0 : isSniffState ? 7.5 : 3.2;
      const tailAmp = hunting || activeWave || isStepDanceState ? 0.28 : 0.14;
      tailPivot.rotation.y = Math.sin(t * tailSpeed) * tailAmp;
      tailPivot.rotation.x = Math.cos(t * tailSpeed * 0.5) * 0.06;

      const sniffTwitch = isSniffState ? Math.max(0, Math.sin(t * 14)) * 0.06 : 0;
      const nScale = rec ? 0.93 : 1.0 + sniffTwitch;
      blackNoseMesh.scale.set(0.146 * S * nScale, 0.142 * S * nScale, 0.136 * S * nScale);

      // ---------------------------------------------------------
      // PROGRESSIVE 1 -> 2 -> 3 BIGGER SNOWBALL ANIMATION
      // ---------------------------------------------------------
      sp.sb2Scale += ((snowTier >= 2 ? 1 : 0) - sp.sb2Scale) * 0.08;
      sp.sb3Scale += ((snowTier >= 3 ? 1 : 0) - sp.sb3Scale) * 0.08;

      const s1Squish = snowTier === 1 ? patWave * 0.065 : 0;
      sb1.scale.set(1.08 + s1Squish, 0.9 - s1Squish, 1.08 + s1Squish);

      sb2.visible = sp.sb2Scale > 0.03;
      const s2Squish = snowTier === 2 ? patWave * 0.065 : 0;
      sb2.scale.set(
        (1.05 + s2Squish) * sp.sb2Scale,
        (0.92 - s2Squish) * sp.sb2Scale,
        (1.05 + s2Squish) * sp.sb2Scale
      );

      sb3Group.visible = sp.sb3Scale > 0.03;
      const s3Squish = snowTier === 3 ? patWave * 0.065 : 0;
      sb3Group.scale.set(
        (1 + s3Squish) * sp.sb3Scale,
        (1 - s3Squish) * sp.sb3Scale,
        (1 + s3Squish) * sp.sb3Scale
      );

      // ---------------------------------------------------------
      // TORSO BREATHING, HEAD-TILT & SNOUT LOOK-UP
      // ---------------------------------------------------------
      sp.sx += (1 - sp.sx) * 0.14;
      sp.sy += (1 - sp.sy) * 0.14;
      sp.sz += (1 - sp.sz) * 0.14;
      sp.jumpY += (0 - sp.jumpY) * 0.14;

      const breath = Math.sin(t * 2.2) * 0.012;
      kanshanRig.scale.set(sp.sx - breath * 0.35, sp.sy + breath, sp.sz - breath * 0.35);

      const targetRoll = activeWave
        ? -0.055
        : isStepDanceState
        ? Math.sin(t * 6.4) * 0.045
        : Math.sin(t * 1.4) * 0.016;
      const targetPitch = isSniffState ? -0.068 : isPatState ? 0.035 : 0;
      kanshanRig.rotation.z += (targetRoll - kanshanRig.rotation.z) * 0.1;
      kanshanRig.rotation.x += (targetPitch - kanshanRig.rotation.x) * 0.1;

      charRoot.position.x = baseCharX + swayX;
      charRoot.position.y = baseCharY + sp.jumpY + stepBobY;
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
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="w-full h-full select-none" />;
}
