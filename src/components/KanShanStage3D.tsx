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
  const springRef = useRef({
    sx: 1,
    sy: 1,
    sz: 1,
    jumpY: 0,
    armLerp: 0,
    waveTimer: 0,
  });
  const rotYRef = useRef(-0.08); // Nearly straight-on cozy sitting pose like reference!

  useEffect(() => {
    petRef.current = pet;
    springRef.current.sx = 1.06;
    springRef.current.sy = 0.94;
    springRef.current.sz = 1.06;
    springRef.current.jumpY = 0.08;
  }, [pet.equippedItems, pet.mood]);

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    stackingRef.current = isStackingSnow;
    springRef.current.jumpY = 0.09;
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
      const extraZ = aspect < 0.72 ? (0.72 - aspect) * 9.2 : 0;
      camera.position.set(0, 0.48, 9.5 + extraZ);
      camera.lookAt(0, -0.32, 0);
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
    renderer.toneMappingExposure = 1.06;
    syncCameraAndSize(width, height);

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // =========================================================
    // DREAMY BLIND-BOX STUDIO LIGHTING
    // =========================================================
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd4e6fb, 1.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffefa, 1.05);
    keyLight.position.set(-2.6, 6.2, 5.6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.radius = 5;
    scene.add(keyLight);

    const frontFill = new THREE.DirectionalLight(0xf2f8ff, 0.48);
    frontFill.position.set(1.8, 0.8, 5.5);
    scene.add(frontFill);

    // =========================================================
    // 1. ARCTIC ROOM PROPS: SHELL SOFA + PLUSH PAW RUG + ICE GLOW
    // =========================================================
    const roomGroup = new THREE.Group();
    scene.add(roomGroup);

    const floorShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.ShadowMaterial({ opacity: 0.12 })
    );
    floorShadow.rotation.x = -Math.PI / 2;
    floorShadow.position.y = -1.38;
    floorShadow.receiveShadow = true;
    roomGroup.add(floorShadow);

    // Soft Vertical Ice Reflection Glow on Foreground Floor (like reference!)
    const iceSheen = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.24,
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

    // Thick Puffy Blue & White Paw Rug
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
    // 2. SITTING MARSHMALLOW LIU KANSHAN (1:1 BLIND-BOX PROPORTIONS!)
    // =========================================================
    const charRoot = new THREE.Group();
    // Sitting squarely right on the puffy white paw rug!
    charRoot.position.set(0, -0.58, 0.16);
    scene.add(charRoot);

    const S = 1.46;

    // Bag Charm Lanyard
    const lanyardGroup = new THREE.Group();
    const strap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.82, 16),
      new THREE.MeshStandardMaterial({ color: 0x4a8df8, roughness: 0.55 })
    );
    strap.position.set(0, 1.32, -0.02);
    const clasp = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.036, 16, 32),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.88, roughness: 0.18 })
    );
    clasp.position.set(0, 1.78, -0.02);
    lanyardGroup.add(strap, clasp);
    charRoot.add(lanyardGroup);

    const kanshanRig = new THREE.Group();
    charRoot.add(kanshanRig);

    // Designer-Toy Soft Flocked / Matte Vinyl Materials!
    const vinylWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.0,
      emissive: 0xf4f8ff,
      emissiveIntensity: 0.11,
    });
    // Low-saturation velvety dark slate-navy (NOT harsh dead #000000!)
    const velvetSlateMat = new THREE.MeshStandardMaterial({
      color: 0x354054,
      roughness: 0.68,
      metalness: 0.02,
    });
    const noseRubberMat = new THREE.MeshStandardMaterial({
      color: 0x343f53,
      roughness: 0.62,
      metalness: 0.03,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x1e2532,
      roughness: 0.45,
      metalness: 0.02,
    });

    // A) 1:1 Wide-Head Marshmallow Sitting Body + Plump Tail
    const whiteBodyMesh = buildSmoothSDFMesh(76, vinylWhiteMat, (x, y, z) => {
      const dBody = evalCartoonKanshanSDF(x, y, z);
      // Plump fluffy fox tail resting on the rug behind (-Y=-0.34) for 3-point blind-box stability!
      const dTail = sdSphere(x, y, z, 0, -0.32, -0.44, 0.148);
      return smin(dBody, dTail, 0.048);
    });
    whiteBodyMesh.scale.setScalar(S);
    whiteBodyMesh.castShadow = true;
    whiteBodyMesh.receiveShadow = true;
    whiteBodyMesh.name = "head";
    kanshanRig.add(whiteBodyMesh);

    // B)Two Chubby Marshmallow Sitting Short Feet in Front (Exact match to reference!)
    [-1, 1].forEach((side) => {
      const foot = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.145, 0.16, 18, 24),
        vinylWhiteMat
      );
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(0.96, 1.0, 0.88);
      foot.position.set(side * 0.28, -0.56, 0.48);
      foot.castShadow = true;
      foot.receiveShadow = true;
      kanshanRig.add(foot);
    });

    // C) Plump Velvety Round-Oval Rubber Nose Button (soft diffused sheen, zero harsh glare!)
    const blackNoseMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 36),
      noseRubberMat
    );
    blackNoseMesh.scale.set(0.165 * S, 0.145 * S, 0.132 * S);
    blackNoseMesh.position.set(0, 0.185 * S, 0.435 * S);
    blackNoseMesh.castShadow = true;
    blackNoseMesh.name = "nose";
    kanshanRig.add(blackNoseMesh);

    // D) Iconic Minimalist Deadpan Small Dot Eyes (`•    •` — NO messy anime highlights!)
    const eyeX = 0.242;
    const eyeY = 0.238;
    const eyeZ = findFaceSurfaceZ(eyeX, eyeY);

    const beadEyesGroup = new THREE.Group();
    const createDeadpanDotEye = (side: number) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.024 * S, 20, 20), pupilMat);
      dot.scale.set(0.92, 1.18, 0.7);
      dot.position.set(side * eyeX * S, eyeY * S, (eyeZ + 0.008) * S);
      dot.rotation.y = side * 0.22;
      return dot;
    };
    const leftEye = createDeadpanDotEye(-1);
    const rightEye = createDeadpanDotEye(1);
    beadEyesGroup.add(leftEye, rightEye);
    kanshanRig.add(beadEyesGroup);

    // Happy Crescent Smile Eyes (`^    ^` when patted, fed, or stacking snowballs!)
    const happyEyesGroup = new THREE.Group();
    const arcGeo = new THREE.TorusGeometry(0.038 * S, 0.011 * S, 12, 24, Math.PI * 0.85);
    [-1, 1].forEach((side) => {
      const smile = new THREE.Mesh(arcGeo, pupilMat);
      smile.position.set(side * eyeX * S, (eyeY - 0.006) * S, (eyeZ + 0.012) * S);
      smile.rotation.set(0.05, side * 0.22, Math.PI * 0.08);
      happyEyesGroup.add(smile);
    });
    happyEyesGroup.visible = false;
    kanshanRig.add(happyEyesGroup);

    // E) Plump Teardrop Plushie Arms (Thinner at shoulder, fuller & rounder at paw — resting beside feet!)
    const armY = -0.06;
    const armZ = 0.04;
    const shoulderSurfX = findSurfaceX(armY, armZ);

    const createTeardropArm = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (shoulderSurfX - 0.035) * S, armY * S, armZ * S);

      // Build smooth teardrop-tapered plush arm using stacked spheres/capsules along curve
      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.12, -0.22, 0.05),
        new THREE.Vector3(side * 0.14, -0.46, 0.12),
      ]);

      // Tapered custom tube geometry (thicker toward the cute chubby paw!)
      const tubularSegs = 24;
      const radialSegs = 18;
      const frames = armCurve.computeFrenetFrames(tubularSegs, false);
      const pos: number[] = [];
      const idx: number[] = [];

      for (let i = 0; i <= tubularSegs; i++) {
        const u = i / tubularSegs;
        const p = armCurve.getPointAt(u);
        const N = frames.normals[i];
        const B = frames.binormals[i];
        // Taper from 0.048 at shoulder -> 0.076 plump wrist!
        const r = 0.048 + u * 0.028;
        for (let j = 0; j <= radialSegs; j++) {
          const v = (j / radialSegs) * Math.PI * 2;
          const sin = Math.sin(v);
          const cos = -Math.cos(v);
          const vx = p.x + r * (cos * N.x + sin * B.x);
          const vy = p.y + r * (cos * N.y + sin * B.y);
          const vz = p.z + r * (cos * N.z + sin * B.z);
          pos.push(vx, vy, vz);
        }
      }
      for (let i = 0; i < tubularSegs; i++) {
        for (let j = 0; j < radialSegs; j++) {
          const a = i * (radialSegs + 1) + j;
          const b = (i + 1) * (radialSegs + 1) + j;
          const c = (i + 1) * (radialSegs + 1) + (j + 1);
          const d = i * (radialSegs + 1) + (j + 1);
          idx.push(a, b, d, b, c, d);
        }
      }
      const taperedGeo = new THREE.BufferGeometry();
      taperedGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      taperedGeo.setIndex(idx);
      taperedGeo.computeVertexNormals();

      const armMesh = new THREE.Mesh(taperedGeo, velvetSlateMat);
      armMesh.castShadow = true;

      // Plump rounded paw tip + cute little inner thumb nub!
      const pawEnd = new THREE.Mesh(new THREE.SphereGeometry(0.076, 20, 20), velvetSlateMat);
      pawEnd.scale.set(0.95, 1.08, 0.95);
      pawEnd.position.set(side * 0.14, -0.46, 0.12);
      pawEnd.castShadow = true;

      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 14), velvetSlateMat);
      thumb.scale.set(1.2, 0.85, 0.9);
      thumb.position.set(side * 0.085, -0.44, 0.165);

      pivot.add(armMesh, pawEnd, thumb);
      return pivot;
    };

    const leftArm = createTeardropArm(-1);
    const rightArm = createTeardropArm(1);
    kanshanRig.add(leftArm, rightArm);

    // =========================================================
    // 3. THREE FLUFFY STACKED SNOWBALLS RIGHT BETWEEN SITTING FEET!
    // =========================================================
    const snowStack = new THREE.Group();
    snowStack.position.set(0, -0.74, 0.72);
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      emissive: 0xf0f7ff,
      emissiveIntensity: 0.1,
    });

    const sb1 = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 24), snowMat);
    sb1.scale.set(1.08, 0.9, 1.08);
    sb1.position.set(0, 0.14, 0.12);
    sb1.castShadow = true;
    sb1.name = "snowman";

    const sb2 = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), snowMat);
    sb2.scale.set(1.05, 0.92, 1.05);
    sb2.position.set(0, 0.41, 0.04);
    sb2.castShadow = true;
    sb2.name = "snowman";

    const sb3 = new THREE.Mesh(new THREE.SphereGeometry(0.155, 24, 24), snowMat);
    sb3.position.set(0, 0.66, -0.02);
    sb3.castShadow = true;
    sb3.name = "snowman";

    snowStack.add(sb1, sb2, sb3);
    kanshanRig.add(snowStack);

    // =========================================================
    // 4. DESIGNER-TOY SCULPTED ACCESSORIES
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
    fishGroup.position.set(0.76, -0.44, 0.28);
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
          springRef.current.sx = 1.05;
          springRef.current.sy = 0.95;
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
          springRef.current.sx = 1.08;
          springRef.current.sy = 0.91;
          springRef.current.jumpY = 0.1;
          springRef.current.waveTimer = 1.2; // Cute greeting wave when patted!
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
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.elapsedTime;
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

      const sp = springRef.current;
      if (sp.waveTimer > 0) sp.waveTimer = Math.max(0, sp.waveTimer - dt);

      // Blink vs Happy Crescent Eyes
      const isSmiling = stacking || curPet.mood === "happy" || sp.waveTimer > 0;
      happyEyesGroup.visible = isSmiling;
      beadEyesGroup.visible = !isSmiling;
      if (!isSmiling) {
        const blink = (t % 3.8) > 3.64;
        leftEye.scale.set(0.92, blink ? 0.15 : 1.18, 0.7);
        rightEye.scale.set(0.92, blink ? 0.15 : 1.18, 0.7);
      }

      // Arms Tween: Resting cutely beside sitting feet vs Hugging the top snowball (Image 2!)
      sp.armLerp += ((stacking ? 1 : 0) - sp.armLerp) * 0.14;
      const baseArmX = (shoulderSurfX - 0.035) * S;
      const hugArmX = 0.38 * S;
      const curArmY = (armY - sp.armLerp * 0.04) * S;
      const curArmZ = (armZ + sp.armLerp * 0.24) * S;

      leftArm.position.set(-(baseArmX + (hugArmX - baseArmX) * sp.armLerp), curArmY, curArmZ);
      rightArm.position.set(baseArmX + (hugArmX - baseArmX) * sp.armLerp, curArmY, curArmZ);

      leftArm.rotation.x = -sp.armLerp * 0.88;
      leftArm.rotation.y = sp.armLerp * 0.42;
      leftArm.rotation.z = sp.armLerp * 0.56 + (1 - sp.armLerp) * Math.sin(t * 1.8) * 0.025;

      // Cute right-hand wave when patted (`打招呼`)!
      if (sp.waveTimer > 0 && sp.armLerp < 0.2) {
        rightArm.rotation.z = -2.1 + Math.sin(t * 16) * 0.28;
        rightArm.rotation.x = -0.3;
      } else {
        rightArm.rotation.x = -sp.armLerp * 0.88;
        rightArm.rotation.y = -sp.armLerp * 0.42;
        rightArm.rotation.z = -sp.armLerp * 0.56 - (1 - sp.armLerp) * Math.sin(t * 1.8) * 0.025;
      }

      snowStack.visible = !bagMode && (stacking || sp.armLerp > 0.08);
      const sScale = stacking ? 1.0 : 0.001;
      snowStack.scale.lerp(new THREE.Vector3(sScale, sScale, sScale), 0.16);

      const nScale = rec ? 0.93 : 1.0;
      blackNoseMesh.scale.set(0.165 * S * nScale, 0.145 * S * nScale, 0.132 * S * nScale);

      // Living Cozy Micro-Motion: Gentle slow side-to-side rock (`晃悠`) + soft breathing!
      sp.sx += (1 - sp.sx) * 0.14;
      sp.sy += (1 - sp.sy) * 0.14;
      sp.sz += (1 - sp.sz) * 0.14;
      sp.jumpY += (0 - sp.jumpY) * 0.14;

      const breath = Math.sin(t * 2.1) * 0.012;
      kanshanRig.scale.set(sp.sx - breath * 0.35, sp.sy + breath, sp.sz - breath * 0.35);
      // Gentle adorable head/body tilt rock (`晃悠`)
      kanshanRig.rotation.z = Math.sin(t * 1.35) * 0.022;

      const baseY = bagMode ? -0.18 + Math.sin(t * 2) * 0.05 : -0.58;
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
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="w-full h-full select-none" />;
}
