"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
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

// Grounded surface heights: white paw rug top = -1.276, sofa cushion top = -0.738
// Kept cleanly away from standing Kanshan's boots so both boots & contact shadows show!
const TREASURE_SPOTS: [number, number, number][] = [
  [0.36, -1.274, 1.04], // Front foreground rug (generously clear of boots from any angle!)
  [0.68, -1.274, 0.60], // Right-front rug
  [-0.64, -0.738, -1.20], // Inner sofa cushion top
];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  g.addColorStop(0, "rgba(72, 108, 158, 0.34)");
  g.addColorStop(0.55, "rgba(92, 132, 184, 0.14)");
  g.addColorStop(1, "rgba(120, 160, 210, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
    waveLerp: 0,
    waveTimer: 0,
    patBoost: 1.6,
    treasureScale: 1,
    ambientSnowTime: 0,
    sb2Scale: 0,
    sb3Scale: 0,
    userRotatedTimer: 0,
    // Smooth spring-damped head & ear secondary motion!
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
    earVel: 0,
    earDisp: 0,
    lookX: 0,
    lookY: 0,
  });

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
    springRef.current.jumpY = 0.08;
    springRef.current.earVel += 0.25;
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
      springRef.current.jumpY = 0.24;
      springRef.current.waveTimer = 1.5;
      springRef.current.earVel += 0.4;
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

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // NeutralToneMapping preserves crisp pure snow-whites instead of dull ACES grey!
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.16;

    // Studio IBL Environment Map so vinyl white & charcoal limbs get rich 3D shading & highlights!
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.42;

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

    syncCameraAndSize(width, height);

    container.innerHTML = "";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    // =========================================================
    // 3-POINT WARM-COOL STUDIO + STRONG RIM LIGHTING RIG
    // Gives Liu Kanshan unmistakable 3D form & crisp edge pop!
    // =========================================================
    scene.add(new THREE.AmbientLight(0xeef5ff, 0.72));
    scene.add(new THREE.HemisphereLight(0xfffdf8, 0x9ec0eb, 0.85));

    // 1. Warm Sunlight Key Light (top-front-right -> models snout, brow, and belly!)
    const sunKeyLight = new THREE.DirectionalLight(0xfff8eb, 1.85);
    sunKeyLight.position.set(2.8, 4.8, 4.0);
    sunKeyLight.castShadow = true;
    sunKeyLight.shadow.mapSize.width = 1024;
    sunKeyLight.shadow.mapSize.height = 1024;
    sunKeyLight.shadow.bias = -0.0004;
    sunKeyLight.shadow.radius = 5;
    scene.add(sunKeyLight);

    // 2. Soft Arctic Sky Fill Light (front-left -> keeps shadow side soft sky-blue, never flat!)
    const skyFillLight = new THREE.DirectionalLight(0xc7e0fe, 0.68);
    skyFillLight.position.set(-3.4, 1.6, 2.4);
    scene.add(skyFillLight);

    // 3. Dual Back-Rim Lights (carves a bright luminous outline on ears, crown, and back!)
    const backRimLeft = new THREE.DirectionalLight(0xffffff, 1.65);
    backRimLeft.position.set(-2.2, 3.5, -3.6);
    scene.add(backRimLeft);

    const backRimRight = new THREE.DirectionalLight(0xfff5d6, 1.25);
    backRimRight.position.set(2.4, 2.8, -3.2);
    scene.add(backRimRight);

    // =========================================================
    // 1. ARCTIC ICE ROOM ENVIRONMENT (Slightly deeper cool blue so white Kanshan POPS!)
    // =========================================================
    const roomGroup = new THREE.Group();
    scene.add(roomGroup);

    const floorMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 8.5, 0.3, 64),
      new THREE.MeshStandardMaterial({
        color: 0xb9d6f6,
        roughness: 0.84,
        metalness: 0.02,
      })
    );
    floorMesh.position.set(0, -1.53, -0.5);
    floorMesh.receiveShadow = true;
    roomGroup.add(floorMesh);

    const iceSheen = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 48),
      new THREE.MeshStandardMaterial({
        color: 0xd9ecfe,
        roughness: 0.68,
        transparent: true,
        opacity: 0.55,
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
    const sofaBlue = new THREE.MeshStandardMaterial({ color: 0xa4c8ee, roughness: 0.9 });
    const sofaFrost = new THREE.MeshStandardMaterial({ color: 0xd2e9ff, roughness: 0.92 });

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
    const rugBlue = new THREE.MeshStandardMaterial({ color: 0x7fb6f3, roughness: 0.92 });
    const rugWhite = new THREE.MeshStandardMaterial({ color: 0xf4f9ff, roughness: 0.94 });

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

    // Soft Grounding Contact Shadows under Kanshan & Snowman!
    const shadowTex = createContactShadowTexture();
    const kanshanShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.76, 0.52),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    kanshanShadow.rotation.x = -Math.PI / 2;
    kanshanShadow.position.set(0.11, -1.273, 0.22);
    roomGroup.add(kanshanShadow);

    const snowShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.50),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    snowShadow.rotation.x = -Math.PI / 2;
    snowShadow.position.set(-0.56, -1.273, 0.28);
    roomGroup.add(snowShadow);

    // =========================================================
    // 1.5 SOFT GLOWING & GENTLY FLOATING ROOM TREASURES
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
    // 2. PROGRESSIVE 1 -> 2 -> 3 SNOWBALLS ON RUG
    // =========================================================
    const snowStack = new THREE.Group();
    snowStack.position.set(-0.56, -1.276, 0.28);
    roomGroup.add(snowStack);

    const snowMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.65,
      sheen: 0.45,
      sheenColor: new THREE.Color(0xe0f2fe),
      emissive: 0xf8fbff,
      emissiveIntensity: 0.08,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: 0x161b24,
      roughness: 0.22,
      metalness: 0.08,
    });

    const sb1 = new THREE.Mesh(new THREE.SphereGeometry(0.195, 28, 24), snowMat);
    sb1.scale.set(1.08, 0.9, 1.08);
    sb1.position.set(0, 0.165, 0);
    sb1.castShadow = true;
    sb1.receiveShadow = true;
    sb1.name = "snowman";

    const sb2 = new THREE.Mesh(new THREE.SphereGeometry(0.152, 26, 22), snowMat);
    sb2.position.set(0, 0.425, 0);
    sb2.castShadow = true;
    sb2.visible = false;
    sb2.name = "snowman";

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
    // 3. LUMINOUS, SOFT-SKINNED STANDING LIU KANSHAN!
    // =========================================================
    const S = 0.86;
    const baseCharX = 0.12;
    const baseCharY = -1.276 + 0.796 * S;

    const charRoot = new THREE.Group();
    charRoot.position.set(baseCharX, baseCharY, 0.20);
    charRoot.rotation.y = rotYRef.current;
    scene.add(charRoot);

    const kanshanRig = new THREE.Group();
    charRoot.add(kanshanRig);

    // Plush Designer-Vinyl Material + Custom Rim-Glow & Soft Sky Contour Shader
    // Makes white Liu Kanshan bright, warm, 3D-shaded, and razor-distinct against the pastel blue sky!
    const vinylWhiteMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffefb,
      roughness: 0.56,
      metalness: 0.0,
      sheen: 0.55,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xfffbeb),
      clearcoat: 0.14,
      clearcoatRoughness: 0.5,
      emissive: 0xfffdf9,
      emissiveIntensity: 0.14,
    });

    vinylWhiteMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `
        // Subtle 3D silhouette separation: cool sky-blue grazing tint + bright warm top-rim highlight!
        vec3 nView = normalize(vNormal);
        float ndv = clamp(abs(dot(nView, vec3(0.0, 0.0, 1.0))), 0.0, 1.0);
        float edgeFactor = pow(1.0 - ndv, 2.2);
        // Subtle cool contour shadow along side edges so white ears/body NEVER disappear into light sky!
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.76, 0.85, 0.96), edgeFactor * 0.34);
        // Warm sunlit top-crown highlight
        float topRim = pow(max(0.0, nView.y), 1.6) * edgeFactor;
        gl_FragColor.rgb += vec3(0.16, 0.15, 0.12) * topRim;
        #include <dithering_fragment>
        `
      );
    };

    // Rich Velvety Charcoal-Slate Material (with studio sheen so fingers/boots show 3D volume!)
    const charcoalLimbMat = new THREE.MeshPhysicalMaterial({
      color: 0x262c38,
      roughness: 0.44,
      metalness: 0.04,
      clearcoat: 0.18,
      clearcoatRoughness: 0.42,
    });
    const noseCapMat = new THREE.MeshPhysicalMaterial({
      color: 0x202631,
      roughness: 0.34,
      metalness: 0.05,
      clearcoat: 0.35,
      clearcoatRoughness: 0.28,
    });

    const whiteBodyMesh = buildSmoothSDFMesh(76, vinylWhiteMat, evalCartoonKanshanSDF);
    whiteBodyMesh.scale.setScalar(S);
    whiteBodyMesh.castShadow = true;
    whiteBodyMesh.receiveShadow = true;
    whiteBodyMesh.name = "head";
    kanshanRig.add(whiteBodyMesh);

    // Cache rest-pose vertices & normals for seamless organic neck turning/tilting & ear-tip bounce!
    const posAttr = whiteBodyMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const normAttr = whiteBodyMesh.geometry.getAttribute("normal") as THREE.BufferAttribute;
    const restPos = new Float32Array(posAttr.array);
    const restNorm = new Float32Array(normAttr.array);
    const neckPivotY = 0.04; // Unscaled SDF neck pivot

    // Head Bone Group at (0, neckPivotY * S, 0) — moves nose, eyes, glasses, beanie in 100% lockstep with upper head!
    const headBone = new THREE.Group();
    headBone.position.set(0, neckPivotY * S, 0);
    kanshanRig.add(headBone);

    // Wagging Plump Round White Pom-Pom Tail at lower back
    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.27 * S, -0.28 * S);
    const tailBall = new THREE.Mesh(new THREE.SphereGeometry(0.155 * S, 28, 24), vinylWhiteMat);
    tailBall.position.set(0, 0, -0.11 * S);
    tailBall.castShadow = true;
    tailPivot.add(tailBall);
    kanshanRig.add(tailPivot);

    // Seamless Charcoal-Black Nose Cap (parented to headBone!)
    const blackNoseMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), noseCapMat);
    blackNoseMesh.scale.set(0.146 * S, 0.142 * S, 0.136 * S);
    blackNoseMesh.position.set(0, (0.318 - neckPivotY) * S, 0.495 * S);
    blackNoseMesh.rotation.x = -0.18;
    blackNoseMesh.castShadow = true;
    blackNoseMesh.name = "nose";
    headBone.add(blackNoseMesh);

    // Crisp Vertical-Oval Glossy Bead Eyes (parented to headBone!)
    const eyeX = 0.186;
    const eyeY = 0.338;
    const eyeZ = findFaceSurfaceZ(eyeX, eyeY);

    const beadEyesGroup = new THREE.Group();
    const createOvalBeadEye = (side: number) => {
      const eyeHolder = new THREE.Group();
      eyeHolder.position.set(side * eyeX * S, (eyeY - neckPivotY) * S, (eyeZ + 0.008) * S);
      eyeHolder.rotation.y = side * 0.38;

      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.026 * S, 20, 20), pupilMat);
      dot.scale.set(0.88, 1.24, 0.74);
      eyeHolder.add(dot);

      // Tiny lively white eye catchlight!
      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(0.007 * S, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      glint.position.set(-side * 0.006 * S, 0.012 * S, 0.018 * S);
      eyeHolder.add(glint);

      return eyeHolder;
    };
    const leftEye = createOvalBeadEye(-1);
    const rightEye = createOvalBeadEye(1);
    beadEyesGroup.add(leftEye, rightEye);
    headBone.add(beadEyesGroup);

    const happyEyesGroup = new THREE.Group();
    const arcGeo = new THREE.TorusGeometry(0.032 * S, 0.010 * S, 12, 24, Math.PI * 0.85);
    [-1, 1].forEach((side) => {
      const smile = new THREE.Mesh(arcGeo, pupilMat);
      smile.position.set(side * eyeX * S, (eyeY - 0.004 - neckPivotY) * S, (eyeZ + 0.012) * S);
      smile.rotation.set(0.04, side * 0.38, Math.PI * 0.08);
      happyEyesGroup.add(smile);
    });
    happyEyesGroup.visible = false;
    headBone.add(happyEyesGroup);

    // Seamless 1-Piece SkinnedMesh Arms & Standing Legs!
    const leftArm = buildFourFingeredArm(-1, S, charcoalLimbMat);
    const rightArm = buildFourFingeredArm(1, S, charcoalLimbMat);
    kanshanRig.add(leftArm.root, rightArm.root);

    const leftLeg = buildStandingLeg(-1, S, charcoalLimbMat);
    const rightLeg = buildStandingLeg(1, S, charcoalLimbMat);
    kanshanRig.add(leftLeg.root, rightLeg.root);

    // =========================================================
    // 4. FITTED OPTIONAL ACCESSORIES
    // =========================================================
    const headOffsetGroup = new THREE.Group();
    headOffsetGroup.position.y = -neckPivotY * S;
    headBone.add(headOffsetGroup);

    const glassesGroup = buildDetailedGlasses(S, eyeY);
    headOffsetGroup.add(glassesGroup);

    const beanieGroup = buildKnittedBeanie(S);
    headOffsetGroup.add(beanieGroup);

    const muffsGroup = buildPlushEarmuffs(S);
    headOffsetGroup.add(muffsGroup);

    const scarfGroup = buildContouredKnittedScarf(S);
    kanshanRig.add(scarfGroup);

    const fishGroup = buildCuteCodfish();
    fishGroup.scale.setScalar(0.72 * S);
    fishGroup.position.set(0.04 * S, -0.02 * S, 0.06 * S);
    fishGroup.rotation.z = -0.35;
    rightArm.wrist.add(fishGroup);

    // =========================================================
    // 5. RAYCASTER, CURSOR GAZE & SMOOTH 360° TURNTABLE DRAG
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
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        springRef.current.lookX = Math.max(-1, Math.min(1, nx));
        springRef.current.lookY = Math.max(-1, Math.min(1, ny));
      }

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
          springRef.current.sx = 1.06;
          springRef.current.sy = 0.93;
          springRef.current.jumpY = 0.12;
          springRef.current.waveTimer = 2.0;
          springRef.current.earVel += 0.35;
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
    // 6. FLUID, SUPPLE ORGANIC ANIMATION LOOP
    // =========================================================
    let raf = 0;
    const clock = new THREE.Clock();
    const headQuat = new THREE.Quaternion();
    const headEuler = new THREE.Euler();
    const tmpVec = new THREE.Vector3();

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

      sp.ambientSnowTime = Math.min(30, sp.ambientSnowTime + dt);
      const effectiveSnow = Math.min(
        100,
        (curPet.snowballProgress || 20) + sp.ambientSnowTime * 2.8
      );
      const snowTier = effectiveSnow >= 80 ? 3 : effectiveSnow >= 48 ? 2 : 1;

      sp.treasureScale += (1 - sp.treasureScale) * 0.12;
      treasuresGroup.scale.setScalar(sp.treasureScale);

      activePods.forEach((pod, idx) => {
        const phase = t * 1.75 + idx * 2.1;
        pod.propGroup.position.y = 0.17 + Math.sin(phase) * 0.032;
        pod.propGroup.rotation.y = Math.sin(t * 0.75 + idx) * 0.25;
        const haloPulse = 0.95 + Math.sin(phase) * 0.08;
        pod.haloMesh.scale.set(haloPulse, haloPulse, 1);
        pod.auraMesh.position.y = 0.21 + Math.sin(phase) * 0.02;
        pod.auraMesh.lookAt(camera.position);
        pod.stars.forEach((star, sIdx) => {
          const spPhase = t * 1.85 + idx * 1.4 + sIdx * 1.9;
          star.scale.setScalar(0.72 + Math.sin(spPhase) * 0.2);
          star.rotation.z = Math.sin(t * 0.6 + sIdx) * 0.25;
          star.lookAt(camera.position);
        });
      });

      const eq = curPet.equippedItems || [];
      glassesGroup.visible = eq.includes("thick_glasses");
      scarfGroup.visible = eq.includes("zhihu_scarf");
      beanieGroup.visible = eq.includes("camp_beanie");
      fishGroup.visible = eq.includes("codfish_plush");
      muffsGroup.visible = eq.includes("ear_muffs");

      // Smooth S-curve weights across 20s idle loop (zero robotic hard cuts!)
      const p20 = t % 20.0;
      const isPatting =
        !hunting &&
        sp.waveTimer <= 0 &&
        (sp.patBoost > 0 || p20 < 4.0 || (p20 >= 11.5 && p20 < 15.0));
      const isGrooving =
        !hunting && sp.waveTimer <= 0 && !isPatting && p20 >= 7.5 && p20 < 11.5;
      const isWaving =
        !hunting && (sp.waveTimer > 0 || (!isPatting && p20 >= 15.8 && p20 < 19.2));

      sp.armLerp += ((isPatting ? 1 : 0) - sp.armLerp) * 0.09;
      sp.waveLerp += ((isWaving ? 1 : 0) - sp.waveLerp) * 0.11;

      if (!dragging && sp.userRotatedTimer <= 0) {
        const targetBodyYaw = isPatting
          ? -0.16
          : isGrooving
          ? 0.28 + Math.sin(t * 2.8) * 0.12
          : 0.32;
        const diff =
          ((targetBodyYaw - rotYRef.current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        rotYRef.current += diff * 0.035;
      }

      // ---------------------------------------------------------
      // INDEPENDENT SUPPLE HEAD TURN, CURIOUS TILT & EAR BOUNCE!
      // ---------------------------------------------------------
      const gazeYaw = sp.lookX * 0.18;
      const gazePitch = sp.lookY * 0.10;

      const targetHeadYaw = isPatting
        ? -0.18 + gazeYaw * 0.3
        : isWaving
        ? -0.10 + gazeYaw
        : Math.sin(t * 0.95) * 0.16 + gazeYaw;
      const targetHeadPitch = isPatting
        ? 0.12
        : isWaving
        ? -0.05 + gazePitch
        : Math.sin(t * 1.25) * 0.06 - 0.03 + gazePitch;
      const targetHeadRoll = isWaving
        ? -0.13
        : isGrooving
        ? Math.sin(t * 5.6) * 0.08
        : Math.sin(t * 0.8) * 0.055;

      const prevHeadYaw = sp.headYaw;
      sp.headYaw += (targetHeadYaw - sp.headYaw) * 0.09;
      sp.headPitch += (targetHeadPitch - sp.headPitch) * 0.09;
      sp.headRoll += (targetHeadRoll - sp.headRoll) * 0.09;

      // Spring physics on floppy ear tips driven by head motion & vertical bounce!
      const headTurnImpulse = (sp.headYaw - prevHeadYaw) * 2.5;
      sp.earVel += (-sp.earDisp * 28.0 - sp.earVel * 5.2 + headTurnImpulse) * dt;
      sp.earDisp += sp.earVel * dt;

      headEuler.set(sp.headPitch, sp.headYaw, sp.headRoll, "YXZ");
      headQuat.setFromEuler(headEuler);
      headBone.quaternion.copy(headQuat);

      // Soft-skin deform whiteBodyMesh across neck zone [-0.08 .. +0.16] + ear-tip lag!
      const pArr = posAttr.array as Float32Array;
      const nArr = normAttr.array as Float32Array;
      const vCount = posAttr.count;
      const qx = headQuat.x;
      const qy = headQuat.y;
      const qz = headQuat.z;
      const qw = headQuat.w;

      for (let i = 0; i < vCount; i++) {
        const i3 = i * 3;
        const rx = restPos[i3];
        const ry = restPos[i3 + 1];
        const rz = restPos[i3 + 2];

        const wNeck = smoothstep(-0.08, 0.16, ry);
        if (wNeck <= 0.0001) {
          pArr[i3] = rx;
          pArr[i3 + 1] = ry;
          pArr[i3 + 2] = rz;
          nArr[i3] = restNorm[i3];
          nArr[i3 + 1] = restNorm[i3 + 1];
          nArr[i3 + 2] = restNorm[i3 + 2];
          continue;
        }

        // Blend quaternion from identity to headQuat
        const bx = qx * wNeck;
        const by = qy * wNeck;
        const bz = qz * wNeck;
        const bw = 1.0 + (qw - 1.0) * wNeck;
        const invLen = 1.0 / Math.hypot(bx, by, bz, bw);
        const uqx = bx * invLen;
        const uqy = by * invLen;
        const uqz = bz * invLen;
        const uqw = bw * invLen;

        // Rotate position around (0, neckPivotY, 0)
        const py = ry - neckPivotY;
        const tx = 2 * (uqy * rz - uqz * py);
        const ty = 2 * (uqz * rx - uqx * rz);
        const tz = 2 * (uqx * py - uqy * rx);

        let dx = rx + uqw * tx + (uqy * tz - uqz * ty);
        let dy = py + uqw * ty + (uqz * tx - uqx * tz) + neckPivotY;
        let dz = rz + uqw * tz + (uqx * ty - uqy * tx);

        // Cute floppy ear-tip inertia above y = 0.44!
        if (ry > 0.44) {
          const wEar = smoothstep(0.44, 0.68, ry);
          dx -= sp.earDisp * wEar * 0.16;
          dz -= Math.abs(sp.earDisp) * wEar * 0.08;
        }

        pArr[i3] = dx;
        pArr[i3 + 1] = dy;
        pArr[i3 + 2] = dz;

        // Rotate normal
        const nx0 = restNorm[i3];
        const ny0 = restNorm[i3 + 1];
        const nz0 = restNorm[i3 + 2];
        const ntx = 2 * (uqy * nz0 - uqz * ny0);
        const nty = 2 * (uqz * nx0 - uqx * nz0);
        const ntz = 2 * (uqx * ny0 - uqy * nx0);
        nArr[i3] = nx0 + uqw * ntx + (uqy * ntz - uqz * nty);
        nArr[i3 + 1] = ny0 + uqw * nty + (uqz * ntx - uqx * ntz);
        nArr[i3 + 2] = nz0 + uqw * ntz + (uqx * nty - uqy * ntx);
      }
      posAttr.needsUpdate = true;
      normAttr.needsUpdate = true;

      // ---------------------------------------------------------
      // EXPRESSIVE BLINKING & SMILING EYES
      // ---------------------------------------------------------
      const isSmiling =
        hunting ||
        curPet.mood === "happy" ||
        sp.waveLerp > 0.5 ||
        isGrooving ||
        sp.armLerp > 0.72;
      happyEyesGroup.visible = isSmiling;
      beadEyesGroup.visible = !isSmiling;
      if (!isSmiling) {
        const bc = t % 4.0;
        const blink = (bc > 3.55 && bc < 3.69) || (bc > 3.77 && bc < 3.89 && p20 < 8);
        leftEye.scale.y = blink ? 0.12 : 1.0;
        rightEye.scale.y = blink ? 0.12 : 1.0;
      }

      // ---------------------------------------------------------
      // 2-JOINT SUPPLE ARMS (Relaxed A-frame + Elbow/Wrist Follow-Through!)
      // ---------------------------------------------------------
      const patWave = Math.max(0, Math.sin(t * 7.8)) * sp.armLerp;
      const breatheSwing = Math.sin(t * 2.2);

      if (hunting) {
        // Joyful running arms spread out with bent elbows!
        const rWave = Math.sin(t * 14);
        leftArm.shoulder.rotation.set(-0.35, 0, -1.55 + rWave * 0.25);
        leftArm.elbow.rotation.set(-0.45, 0, -0.2);
        leftArm.wrist.rotation.set(0, 0, rWave * 0.2);

        rightArm.shoulder.rotation.set(-0.35, 0, 1.55 - rWave * 0.25);
        rightArm.elbow.rotation.set(-0.45, 0, 0.2);
        rightArm.wrist.rotation.set(0, 0, -rWave * 0.2);
      } else {
        // Natural relaxed A-frame base pose (soft outward hang + bent elbows!)
        const grooveSwing = isGrooving ? Math.sin(t * 5.6) * 0.34 : breatheSwing * 0.04;
        const grooveLag = isGrooving ? Math.sin(t * 5.6 - 0.45) * 0.24 : 0;

        // Left arm blends smoothly between: Relaxed/Groove <-> Patting <-> Waving!
        const patShX = snowTier === 1 ? -0.15 : snowTier === 2 ? -0.28 : -0.40;
        const patShZ = -0.28 - patWave * 0.03;
        const patElX = -0.35 - patWave * 0.18;
        const patWrX = patWave * 0.22;

        const waveCycle = Math.sin(t * 9.5);
        const waveLag = Math.sin(t * 9.5 - 0.55);
        const waveShX = -0.22;
        const waveShZ = -2.05 + waveCycle * 0.14;
        const waveElZ = -0.28 + waveLag * 0.26;
        const waveWrZ = Math.sin(t * 9.5 - 0.9) * 0.22;

        const restWeight = Math.max(0, 1 - sp.armLerp - sp.waveLerp);

        leftArm.shoulder.rotation.x =
          restWeight * (-0.06 + grooveSwing) + sp.armLerp * patShX + sp.waveLerp * waveShX;
        leftArm.shoulder.rotation.y = sp.waveLerp * 0.18;
        leftArm.shoulder.rotation.z =
          restWeight * (-0.21 - breatheSwing * 0.025) +
          sp.armLerp * patShZ +
          sp.waveLerp * waveShZ;

        leftArm.elbow.rotation.x =
          restWeight * (-0.26 + grooveLag) + sp.armLerp * patElX + sp.waveLerp * -0.22;
        leftArm.elbow.rotation.z = sp.waveLerp * waveElZ;

        leftArm.wrist.rotation.x = sp.armLerp * patWrX;
        leftArm.wrist.rotation.z = restWeight * 0.10 + sp.waveLerp * waveWrZ;

        // Right arm: natural relaxed A-frame + opposite groove swing with elbow lag!
        rightArm.shoulder.rotation.x = -0.06 - grooveSwing;
        rightArm.shoulder.rotation.y = 0;
        rightArm.shoulder.rotation.z = 0.21 + breatheSwing * 0.025;
        rightArm.elbow.rotation.x = -0.26 - grooveLag;
        rightArm.elbow.rotation.z = 0;
        rightArm.wrist.rotation.set(0, 0, -0.10);
      }

      // ---------------------------------------------------------
      // 2-JOINT CUSHIONED KNEES, WEIGHT-SHIFTS & BOUNCY STEPPING!
      // ---------------------------------------------------------
      let bodyOffsetY = 0;
      let bodySwayX = 0;

      if (hunting) {
        const run = Math.sin(t * 15);
        const liftL = Math.max(0, run);
        const liftR = Math.max(0, -run);
        leftLeg.hip.rotation.x = -run * 0.55;
        leftLeg.knee.rotation.x = liftL * 0.75 + 0.1;
        leftLeg.ankle.rotation.x = -liftL * 0.25;

        rightLeg.hip.rotation.x = run * 0.55;
        rightLeg.knee.rotation.x = liftR * 0.75 + 0.1;
        rightLeg.ankle.rotation.x = -liftR * 0.25;

        bodyOffsetY = Math.abs(Math.cos(t * 15)) * 0.12;
      } else if (isGrooving) {
        // Bouncy knee-flex groove + playful alternating heel/toe step!
        const beat = Math.sin(t * 5.6);
        const crouch = Math.abs(Math.sin(t * 5.6)) * 0.24;
        const stepL = Math.max(0, beat);
        const stepR = Math.max(0, -beat);

        leftLeg.hip.rotation.x = -crouch * 0.5 - stepL * 0.26;
        leftLeg.knee.rotation.x = crouch + stepL * 0.52;
        leftLeg.ankle.rotation.x = -crouch * 0.5 - stepL * 0.22;

        rightLeg.hip.rotation.x = -crouch * 0.5 - stepR * 0.26;
        rightLeg.knee.rotation.x = crouch + stepR * 0.52;
        rightLeg.ankle.rotation.x = -crouch * 0.5 - stepR * 0.22;

        bodyOffsetY = -crouch * 0.055 + Math.max(stepL, stepR) * 0.022;
        bodySwayX = beat * 0.032;
      } else {
        // Subtle living knee-cushion micro-flex synchronized with breathing (never locked knees!)
        const microFlex = (Math.sin(t * 2.2) + 1) * 0.045;
        leftLeg.hip.rotation.x += (-microFlex * 0.5 - leftLeg.hip.rotation.x) * 0.14;
        leftLeg.knee.rotation.x += (microFlex - leftLeg.knee.rotation.x) * 0.14;
        leftLeg.ankle.rotation.x += (-microFlex * 0.5 - leftLeg.ankle.rotation.x) * 0.14;

        rightLeg.hip.rotation.x += (-microFlex * 0.5 - rightLeg.hip.rotation.x) * 0.14;
        rightLeg.knee.rotation.x += (microFlex - rightLeg.knee.rotation.x) * 0.14;
        rightLeg.ankle.rotation.x += (-microFlex * 0.5 - rightLeg.ankle.rotation.x) * 0.14;

        bodyOffsetY = -microFlex * 0.018;
        bodySwayX = Math.sin(t * 1.1) * 0.012;
      }

      // ---------------------------------------------------------
      // LIVELY POM-POM TAIL & PROGRESSIVE SNOWBALL SQUISH
      // ---------------------------------------------------------
      const tailFreq = hunting ? 13 : isGrooving || sp.waveLerp > 0.4 ? 8.5 : 3.4;
      const tailAmp = hunting ? 0.32 : isGrooving || sp.waveLerp > 0.4 ? 0.24 : 0.15;
      tailPivot.rotation.y = Math.sin(t * tailFreq - 0.4) * tailAmp;
      tailPivot.rotation.x = Math.cos(t * tailFreq * 0.5) * 0.07;

      const nScale = rec ? 0.93 : 1.0 + Math.max(0, Math.sin(t * 3.2)) * 0.018;
      blackNoseMesh.scale.set(0.146 * S * nScale, 0.142 * S * nScale, 0.136 * S * nScale);

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
      // SQUASH & STRETCH + TORSO FOLLOW-THROUGH
      // ---------------------------------------------------------
      sp.sx += (1 - sp.sx) * 0.14;
      sp.sy += (1 - sp.sy) * 0.14;
      sp.sz += (1 - sp.sz) * 0.14;
      sp.jumpY += (0 - sp.jumpY) * 0.14;

      const breath = Math.sin(t * 2.2) * 0.013;
      kanshanRig.scale.set(sp.sx + breath * 0.4, sp.sy - breath * 0.25, sp.sz + breath * 0.4);

      tmpVec.set(0, 0, 0);
      kanshanRig.rotation.z = bodySwayX * 0.85;
      kanshanRig.rotation.x = sp.armLerp * 0.03;

      charRoot.position.x = baseCharX + bodySwayX;
      charRoot.position.y = baseCharY + sp.jumpY + bodyOffsetY;
      charRoot.rotation.y += (rotYRef.current - charRoot.rotation.y) * 0.1;

      kanshanShadow.position.x = charRoot.position.x;
      const shadowScale = Math.max(0.75, 1 - (sp.jumpY + Math.max(0, bodyOffsetY)) * 1.4);
      kanshanShadow.scale.setScalar(shadowScale);

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
      envTex.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="w-full h-full select-none" />;
}
