"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { HoardedItem, PetState } from "@/types/knowshan";
import {
  buildContouredKnittedScarf,
  buildCuteCodfish,
  buildDetailedGlasses,
  buildKnittedBeanie,
  buildPlushEarmuffs,
  buildSmoothSDFMesh,
  buildSparklingRoomTreasure,
  evalCartoonKanshanSDF,
  findFaceSurfaceZ,
  findSurfaceX,
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

const TREASURE_SPOTS: [number, number, number][] = [
  [0.08, -1.31, 1.02], // Front-edge of paw rug (cleanly below Kanshan's feet!)
  [0.58, -1.27, 0.72], // Right-front paw rug (cleanly below 2-button dock!)
  [-0.78, -0.90, -1.08], // Inner shell sofa cushion (centered between 2D button & glasses!)
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
  });
  const rotYRef = useRef(-0.08);
  const rebuildTreasuresRef = useRef<((items: HoardedItem[]) => void) | null>(null);

  useEffect(() => {
    onSelectHoardRef.current = onSelectHoardItem;
  }, [onSelectHoardItem]);

  useEffect(() => {
    petRef.current = pet;
    springRef.current.sx = 1.06;
    springRef.current.sy = 0.94;
    springRef.current.sz = 1.06;
    springRef.current.jumpY = 0.08;
  }, [pet.equippedItems, pet.mood]);

  useEffect(() => {
    petRef.current = pet;
    springRef.current.patBoost = 2.8;
    // If snowball was just reset after publishing (< 20), restart ambient stacking from 1 ball!
    if ((pet.snowballProgress || 20) <= 18) {
      springRef.current.ambientSnowTime = 0;
    }
  }, [pet.snowballProgress]);

  useEffect(() => {
    petRef.current = pet;
  }, [pet]);

  useEffect(() => {
    hoardRef.current = hoardedItems;
    springRef.current.treasureScale = 0.05; // Pop-in animation when treasures refresh!
    rebuildTreasuresRef.current?.(hoardedItems);
  }, [hoardedItems]);

  useEffect(() => {
    huntingRef.current = isHuntingTreasure;
    if (isHuntingTreasure) {
      springRef.current.jumpY = 0.28;
      springRef.current.waveTimer = 1.2;
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
      camera.position.set(0, 0.52, 9.8 + extraZ);
      camera.lookAt(0, -0.38, 0);
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
    // 1.5 SPARKLING SCATTERED ROOM TREASURES (Directly Clickable!)
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
    // 2. SITTING MARSHMALLOW LIU KANSHAN (PETITE COZY BLIND-BOX SCALE!)
    // =========================================================
    const charRoot = new THREE.Group();
    charRoot.position.set(0, -0.79, 0.22);
    scene.add(charRoot);

    const S = 1.02;
    const K = S / 1.46;

    const kanshanRig = new THREE.Group();
    charRoot.add(kanshanRig);

    const vinylWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.0,
      emissive: 0xf4f8ff,
      emissiveIntensity: 0.11,
    });
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

    const whiteBodyMesh = buildSmoothSDFMesh(76, vinylWhiteMat, (x, y, z) => {
      const dBody = evalCartoonKanshanSDF(x, y, z);
      const dTail = sdSphere(x, y, z, 0, -0.32, -0.44, 0.148);
      return smin(dBody, dTail, 0.048);
    });
    whiteBodyMesh.scale.setScalar(S);
    whiteBodyMesh.castShadow = true;
    whiteBodyMesh.receiveShadow = true;
    whiteBodyMesh.name = "head";
    kanshanRig.add(whiteBodyMesh);

    [-1, 1].forEach((side) => {
      const foot = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.145 * K, 0.16 * K, 18, 24),
        vinylWhiteMat
      );
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(0.96, 1.0, 0.88);
      foot.position.set(side * 0.28 * K, -0.56 * K, 0.48 * K);
      foot.castShadow = true;
      foot.receiveShadow = true;
      kanshanRig.add(foot);
    });

    const blackNoseMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 36),
      noseRubberMat
    );
    blackNoseMesh.scale.set(0.165 * S, 0.145 * S, 0.132 * S);
    blackNoseMesh.position.set(0, 0.185 * S, 0.435 * S);
    blackNoseMesh.castShadow = true;
    blackNoseMesh.name = "nose";
    kanshanRig.add(blackNoseMesh);

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

    const armY = -0.06;
    const armZ = 0.04;
    const shoulderSurfX = findSurfaceX(armY, armZ);

    const createTeardropArm = (side: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (shoulderSurfX - 0.045) * S, armY * S, armZ * S);

      // Seamless spherical shoulder joint tucked inside torso so no tube cap ever pokes out!
      const shoulderCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.052 * K, 16, 16),
        velvetSlateMat
      );
      pivot.add(shoulderCap);

      const armCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.12 * K, -0.22 * K, 0.05 * K),
        new THREE.Vector3(side * 0.14 * K, -0.46 * K, 0.12 * K),
      ]);

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
        const r = (0.048 + u * 0.028) * K;
        for (let j = 0; j <= radialSegs; j++) {
          const v = (j / radialSegs) * Math.PI * 2;
          const sin = Math.sin(v);
          const cos = -Math.cos(v);
          pos.push(
            p.x + r * (cos * N.x + sin * B.x),
            p.y + r * (cos * N.y + sin * B.y),
            p.z + r * (cos * N.z + sin * B.z)
          );
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

      const pawEnd = new THREE.Mesh(new THREE.SphereGeometry(0.076 * K, 20, 20), velvetSlateMat);
      pawEnd.scale.set(0.95, 1.08, 0.95);
      pawEnd.position.set(side * 0.14 * K, -0.46 * K, 0.12 * K);
      pawEnd.castShadow = true;

      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.034 * K, 14, 14), velvetSlateMat);
      thumb.scale.set(1.2, 0.85, 0.9);
      thumb.position.set(side * 0.085 * K, -0.44 * K, 0.165 * K);

      pivot.add(armMesh, pawEnd, thumb);
      return pivot;
    };

    const leftArm = createTeardropArm(-1);
    const rightArm = createTeardropArm(1);
    kanshanRig.add(leftArm, rightArm);

    // =========================================================
    // 3. PROGRESSIVE 1 -> 2 -> 3 SNOWBALL STACK ("一开始只有一个雪球然后慢慢堆起来")
    // =========================================================
    const snowStack = new THREE.Group();
    snowStack.position.set(-0.82 * K, -0.68 * K, 0.42 * K);
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      emissive: 0xf0f7ff,
      emissiveIntensity: 0.14,
    });

    // Ball 1: Always starts as a single plump snowball on the rug!
    const sb1 = new THREE.Mesh(new THREE.SphereGeometry(0.172 * K, 24, 24), snowMat);
    sb1.scale.set(1.08, 0.9, 1.08);
    sb1.position.set(0, 0.14 * K, 0);
    sb1.castShadow = true;
    sb1.name = "snowman";

    // Ball 2: Stacked onto Ball 1 gradually as Kanshan pats!
    const sb2 = new THREE.Mesh(new THREE.SphereGeometry(0.134 * K, 24, 24), snowMat);
    sb2.position.set(0, 0.355 * K, 0);
    sb2.castShadow = true;
    sb2.visible = false;
    sb2.name = "snowman";

    // Ball 3: Top head ball with cute pebble eyes, stacked last!
    const sb3Group = new THREE.Group();
    sb3Group.position.set(0, 0.525 * K, 0);
    sb3Group.visible = false;

    const sb3 = new THREE.Mesh(new THREE.SphereGeometry(0.104 * K, 24, 24), snowMat);
    sb3.castShadow = true;
    sb3.name = "snowman";
    sb3Group.add(sb3);

    [-1, 1].forEach((side) => {
      const pebbleEye = new THREE.Mesh(
        new THREE.SphereGeometry(0.015 * K, 12, 12),
        pupilMat
      );
      pebbleEye.position.set(side * 0.036 * K, 0.012 * K, 0.098 * K);
      sb3Group.add(pebbleEye);
    });

    snowStack.add(sb1, sb2, sb3Group);
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
    fishGroup.scale.setScalar(K);
    fishGroup.position.set(0.76 * K, -0.44 * K, 0.28 * K);
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

      // Prioritize clicking sparkling room treasures!
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
      if (moved < 8) {
        const hit = getHit(e.clientX, e.clientY);
        if (hit && hit.startsWith("hoard_")) {
          const idx = Number(hit.split("_")[1]);
          const item = hoardRef.current[idx];
          if (item) onSelectHoardRef.current(item);
        } else if (hit === "snowman") {
          onTapSnowman();
        } else if (hit === "head" || hit === "nose") {
          springRef.current.sx = 1.08;
          springRef.current.sy = 0.91;
          springRef.current.jumpY = 0.1;
          springRef.current.waveTimer = 1.2;
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
      const hunting = huntingRef.current;
      const rec = recRef.current;

      const sp = springRef.current;
      if (sp.patBoost > 0) sp.patBoost = Math.max(0, sp.patBoost - dt);
      // Gradually accumulate snow progress over time (~10s for 2nd ball, ~22s for 3rd ball!)
      sp.ambientSnowTime = Math.min(30, sp.ambientSnowTime + dt);
      const effectiveSnow = Math.min(
        100,
        (curPet.snowballProgress || 20) + sp.ambientSnowTime * 2.8
      );
      const snowTier = effectiveSnow >= 80 ? 3 : effectiveSnow >= 48 ? 2 : 1;

      sp.treasureScale += (1 - sp.treasureScale) * 0.12;
      treasuresGroup.scale.setScalar(sp.treasureScale);

      // Animate Sparkling Room Treasures (Levitating + Pulsing Halo + Twinkling 4-Point Stars!)
      activePods.forEach((pod, idx) => {
        const phase = t * 2.6 + idx * 2.1;
        pod.propGroup.position.y = 0.22 + Math.sin(phase) * 0.045;
        pod.propGroup.rotation.y = Math.sin(t * 1.1 + idx) * 0.35;

        const haloPulse = 0.92 + Math.sin(phase * 1.3) * 0.16;
        pod.haloMesh.scale.set(haloPulse, haloPulse, 1);

        pod.stars.forEach((star, sIdx) => {
          const spPhase = t * 5.2 + idx * 1.7 + sIdx * 2.1;
          const twinkle = Math.max(0.15, (Math.sin(spPhase) + 1) * 0.58);
          star.scale.setScalar(twinkle);
          star.rotation.z = t * 1.2 + sIdx;
          star.lookAt(camera.position);
        });
      });

      const eq = curPet.equippedItems || [];
      glassesGroup.visible = eq.includes("thick_glasses");
      scarfGroup.visible = eq.includes("zhihu_scarf");
      beanieGroup.visible = eq.includes("camp_beanie");
      fishGroup.visible = eq.includes("codfish_plush");
      muffsGroup.visible = eq.includes("ear_muffs");

      if (sp.waveTimer > 0) sp.waveTimer = Math.max(0, sp.waveTimer - dt);

      // Autonomous Snowball Stacking Cycle ("他自己在那堆")
      const autoPatWindow = (t % 6.4) < 2.7 || sp.patBoost > 0;
      sp.armLerp += ((autoPatWindow && !hunting ? 1 : 0) - sp.armLerp) * 0.12;
      const patWave = Math.max(0, Math.sin(t * 8.6)) * sp.armLerp;

      const isSmiling = hunting || curPet.mood === "happy" || sp.waveTimer > 0 || sp.armLerp > 0.65;
      happyEyesGroup.visible = isSmiling;
      beadEyesGroup.visible = !isSmiling;
      if (!isSmiling) {
        const blink = (t % 3.8) > 3.64;
        leftEye.scale.set(0.92, blink ? 0.15 : 1.18, 0.7);
        rightEye.scale.set(0.92, blink ? 0.15 : 1.18, 0.7);
      }

      const baseArmX = (shoulderSurfX - 0.045) * S;
      // Keep shoulder pivot strictly anchored inside torso (ZERO floating shoulder stub!)
      leftArm.position.set(-baseArmX, armY * S, armZ * S);

      // Target non-clipping angles tailored to current snowball height (pats outer right cheek only!)
      const targetRotX = snowTier === 1 ? -0.42 : snowTier === 2 ? -0.68 : -0.92;
      const targetRotZ = snowTier === 1 ? -0.05 : snowTier === 2 ? -0.09 : -0.12;

      leftArm.rotation.x = sp.armLerp * (targetRotX - patWave * 0.09);
      leftArm.rotation.y = -sp.armLerp * 0.08;
      leftArm.rotation.z =
        sp.armLerp * (targetRotZ - patWave * 0.035) +
        (1 - sp.armLerp) * Math.sin(t * 1.8) * 0.025;

      // Right arm stays relaxed inside shoulder or waves happily when patted
      rightArm.position.set(baseArmX, armY * S, armZ * S);
      if (sp.waveTimer > 0) {
        rightArm.rotation.z = -2.1 + Math.sin(t * 16) * 0.28;
        rightArm.rotation.x = -0.3;
        rightArm.rotation.y = 0;
      } else {
        rightArm.rotation.x = 0;
        rightArm.rotation.y = 0;
        rightArm.rotation.z = -Math.sin(t * 1.8) * 0.025;
      }

      // Smoothly grow Ball 1 -> Ball 2 -> Ball 3 and gently squish whichever ball is on top!
      sp.sb2Scale += ((snowTier >= 2 ? 1 : 0) - sp.sb2Scale) * 0.08;
      sp.sb3Scale += ((snowTier >= 3 ? 1 : 0) - sp.sb3Scale) * 0.08;

      const s1Squish = snowTier === 1 ? patWave * 0.06 : 0;
      sb1.scale.set(1.08 + s1Squish, 0.9 - s1Squish, 1.08 + s1Squish);

      sb2.visible = sp.sb2Scale > 0.03;
      const s2Squish = snowTier === 2 ? patWave * 0.06 : 0;
      sb2.scale.set(
        (1.05 + s2Squish) * sp.sb2Scale,
        (0.92 - s2Squish) * sp.sb2Scale,
        (1.05 + s2Squish) * sp.sb2Scale
      );

      sb3Group.visible = sp.sb3Scale > 0.03;
      const s3Squish = snowTier === 3 ? patWave * 0.06 : 0;
      sb3Group.scale.set(
        (1 + s3Squish) * sp.sb3Scale,
        (1 - s3Squish) * sp.sb3Scale,
        (1 + s3Squish) * sp.sb3Scale
      );

      const nScale = rec ? 0.93 : 1.0;
      blackNoseMesh.scale.set(0.165 * S * nScale, 0.145 * S * nScale, 0.132 * S * nScale);

      sp.sx += (1 - sp.sx) * 0.14;
      sp.sy += (1 - sp.sy) * 0.14;
      sp.sz += (1 - sp.sz) * 0.14;
      sp.jumpY += (0 - sp.jumpY) * 0.14;

      const breath = Math.sin(t * 2.1) * 0.012;
      kanshanRig.scale.set(sp.sx - breath * 0.35, sp.sy + breath, sp.sz - breath * 0.35);
      // Subtle lean toward the snowman when patting it!
      kanshanRig.rotation.z = Math.sin(t * 1.35) * 0.018 + sp.armLerp * 0.045;

      const huntHop = hunting ? Math.abs(Math.sin(t * 12)) * 0.16 : 0;
      charRoot.position.y = -0.79 + sp.jumpY + huntHop;
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
