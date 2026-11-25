"use client";

import React, { useEffect, useRef, useState } from "react";
import { PetState } from "@/types/knowshan";

interface KanShanStage2DProps {
  pet: PetState;
  isStackingSnow: boolean;
  isBagCharmMode: boolean;
  isRecordingNose: boolean;
  onTapHead: () => void;
  onTapNoseStart: () => void;
  onTapNoseEnd: () => void;
  onTapSnowman: () => void;
}

export default function KanShanStage2D({
  pet,
  isStackingSnow,
  isBagCharmMode,
  isRecordingNose,
  onTapHead,
  onTapNoseStart,
  onTapNoseEnd,
  onTapSnowman,
}: KanShanStage2DProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  // Subtle 2.5D Live2D-style cursor gaze tracking (-1..1)
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [squish, setSquish] = useState<"none" | "pat" | "nose">("none");
  const [hearts, setHearts] = useState<number[]>([]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Natural blinking loop
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = 2800 + Math.random() * 2200;
      timeoutId = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 150);
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  // Bounce whenever outfit or stacking changes
  useEffect(() => {
    setSquish("pat");
    const t = setTimeout(() => setSquish("none"), 320);
    return () => clearTimeout(t);
  }, [pet.equippedItems, isStackingSnow, isBagCharmMode]);

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setLook({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    });
  };

  const handlePointerLeave = () => {
    setLook({ x: 0, y: 0 });
  };

  const triggerPat = () => {
    setSquish("pat");
    const id = Date.now();
    setHearts((prev) => [...prev.slice(-3), id]);
    setTimeout(() => setSquish("none"), 340);
    setTimeout(() => setHearts((prev) => prev.filter((x) => x !== id)), 1100);
    onTapHead();
  };

  const handleNoseDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      setSquish("nose");
      onTapNoseStart();
    }, 180);
  };

  const handleNoseUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isRecordingNose) {
      setSquish("none");
      onTapNoseEnd();
    } else {
      triggerPat();
    }
  };

  const eq = pet.equippedItems || [];
  const isSmiling = isStackingSnow || pet.mood === "happy" || squish === "pat";

  // Parallax offsets for Live2D depth feel
  const faceX = look.x * 7;
  const faceY = look.y * 4;
  const noseX = look.x * 10;
  const noseY = look.y * 5;
  const earX = -look.x * 3;

  return (
    <div
      ref={stageRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-full h-full overflow-hidden flex items-center justify-center select-none"
    >
      {/* Keyframe animations for gentle breathing, tail wag, snow drift, and bag pendulum */}
      <style>{`
        @keyframes ks-breathe {
          0%, 100% { transform: translateY(0px) scale(1, 1); }
          50% { transform: translateY(-3px) scale(0.992, 1.012); }
        }
        @keyframes ks-tail {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(10deg); }
        }
        @keyframes ks-pendulum {
          0%, 100% { transform: rotate(-2.2deg); }
          50% { transform: rotate(2.2deg); }
        }
        @keyframes ks-float-up {
          0% { opacity: 0.95; transform: translateY(0) scale(0.8); }
          100% { opacity: 0; transform: translateY(-42px) scale(1.15); }
        }
      `}</style>

      {/* =============================================================== */}
      {/* 2D STORYBOOK ARCTIC ROOM BACKGROUND ILLUSTRATION                */}
      {/* =============================================================== */}
      {!isBagCharmMode ? (
        <svg
          viewBox="0 0 500 800"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <defs>
            <linearGradient id="wallGrad2d" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c4dcf7" />
              <stop offset="56%" stopColor="#e3effd" />
              <stop offset="100%" stopColor="#cde2fa" />
            </linearGradient>
            <linearGradient id="floorGrad2d" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d8e9fc" />
              <stop offset="100%" stopColor="#b8d4f4" />
            </linearGradient>
            <linearGradient id="nightWindow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5b7db1" />
              <stop offset="60%" stopColor="#7fa6d8" />
              <stop offset="100%" stopColor="#a9ccf0" />
            </linearGradient>
            <linearGradient id="shellPetal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d9ecff" />
              <stop offset="100%" stopColor="#a6cbf0" />
            </linearGradient>
          </defs>

          {/* Wall & Cozy Baseboard */}
          <rect x="0" y="0" width="500" height="535" fill="url(#wallGrad2d)" />
          <rect x="0" y="524" width="500" height="14" fill="#eef6ff" opacity="0.85" />
          <rect x="0" y="538" width="500" height="262" fill="url(#floorGrad2d)" />

          {/* Arched Storybook Arctic Window in Upper-Right */}
          <g transform="translate(318, 212)">
            <path
              d="M10 120 L10 52 A46 46 0 0 1 102 52 L102 120 Z"
              fill="url(#nightWindow)"
              stroke="#f4f9ff"
              strokeWidth="7"
              strokeLinejoin="round"
            />
            {/* Soft Aurora Ribbon inside window */}
            <path
              d="M18 68 Q52 46 94 62"
              fill="none"
              stroke="#a7f3d0"
              strokeWidth="6"
              strokeLinecap="round"
              opacity="0.55"
            />
            <circle cx="36" cy="36" r="2.2" fill="#ffffff" opacity="0.85" />
            <circle cx="76" cy="44" r="1.8" fill="#ffffff" opacity="0.75" />
            <circle cx="62" cy="92" r="2.4" fill="#ffffff" opacity="0.8" />
            {/* Window Mullions & Snowy Sill */}
            <line x1="56" y1="8" x2="56" y2="120" stroke="#f4f9ff" strokeWidth="4.5" />
            <line x1="10" y1="68" x2="102" y2="68" stroke="#f4f9ff" strokeWidth="4.5" />
            <rect x="2" y="116" width="108" height="11" rx="5.5" fill="#ffffff" />
          </g>

          {/* Soft Diagonal Window Light Across Wall */}
          <polygon
            points="60,0 265,0 385,538 120,538"
            fill="#ffffff"
            opacity="0.22"
          />

          {/* 2D Illustrated Scalloped Plush Shell Sofa (Left) */}
          <g transform="translate(26, 368)">
            <ellipse cx="110" cy="182" rx="96" ry="16" fill="#94b9e3" opacity="0.38" />
            {/* 5 Shell Backrest Petals */}
            <path d="M24 128 C12 72, 42 46, 58 118 Z" fill="url(#shellPetal)" stroke="#9bc2ea" strokeWidth="2" />
            <path d="M50 124 C45 48, 80 28, 92 118 Z" fill="#cbe3fb" stroke="#9bc2ea" strokeWidth="2" />
            <path d="M84 122 C86 36, 128 36, 130 122 Z" fill="url(#shellPetal)" stroke="#9bc2ea" strokeWidth="2" />
            <path d="M122 118 C134 28, 170 48, 164 124 Z" fill="#cbe3fb" stroke="#9bc2ea" strokeWidth="2" />
            <path d="M154 118 C170 46, 200 72, 188 128 Z" fill="url(#shellPetal)" stroke="#9bc2ea" strokeWidth="2" />
            {/* Plump Sofa Cushion & Base */}
            <rect x="18" y="126" width="180" height="48" rx="24" fill="#a8ccf0" stroke="#93bbe6" strokeWidth="2" />
            <ellipse cx="108" cy="128" rx="84" ry="20" fill="#e4f1fe" />
            <circle cx="24" cy="124" r="16" fill="#c5e0fa" />
            <circle cx="192" cy="124" r="16" fill="#c5e0fa" />
          </g>

          {/* 2D Illustrated Giant Blue & White Paw-Print Rug */}
          <g transform="translate(250, 596)">
            <ellipse cx="0" cy="14" rx="196" ry="52" fill="#8ec1f6" stroke="#7ab3ef" strokeWidth="2.5" />
            {/* 4 Cute Paw Toes */}
            <ellipse cx="-146" cy="-24" rx="44" ry="20" transform="rotate(-12 -146 -24)" fill="#8ec1f6" stroke="#7ab3ef" strokeWidth="2" />
            <ellipse cx="-144" cy="-23" rx="29" ry="13" transform="rotate(-12 -144 -23)" fill="#f9fcff" />

            <ellipse cx="-54" cy="-46" rx="46" ry="20" transform="rotate(-4 -54 -46)" fill="#8ec1f6" stroke="#7ab3ef" strokeWidth="2" />
            <ellipse cx="-54" cy="-45" rx="31" ry="13" transform="rotate(-4 -54 -45)" fill="#f9fcff" />

            <ellipse cx="54" cy="-46" rx="46" ry="20" transform="rotate(4 54 -46)" fill="#8ec1f6" stroke="#7ab3ef" strokeWidth="2" />
            <ellipse cx="54" cy="-45" rx="31" ry="13" transform="rotate(4 54 -45)" fill="#f9fcff" />

            <ellipse cx="146" cy="-24" rx="44" ry="20" transform="rotate(12 146 -24)" fill="#8ec1f6" stroke="#7ab3ef" strokeWidth="2" />
            <ellipse cx="144" cy="-23" rx="29" ry="13" transform="rotate(12 144 -23)" fill="#f9fcff" />

            {/* Inner Soft Cream-White Paw Pad */}
            <ellipse cx="0" cy="15" rx="154" ry="39" fill="#f9fcff" />
          </g>
        </svg>
      ) : (
        /* Cozy Canvas Tote Texture Backdrop when in 2D Bag Charm Mode */
        <div
          className="absolute inset-0 pointer-events-none opacity-45"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.6) 1.5px, transparent 1.5px)",
            backgroundSize: "18px 18px",
          }}
        />
      )}

      {/* =============================================================== */}
      {/* INTERACTIVE 2D STORYBOOK LIU KANSHAN                            */}
      {/* =============================================================== */}
      <div
        className="relative z-10 mt-14 flex items-center justify-center"
        style={{
          animation: isBagCharmMode ? "ks-pendulum 3.6s ease-in-out infinite" : undefined,
          transformOrigin: "50% 10%",
        }}
      >
        {/* Floating Sparkle Notes on Head Pat */}
        {hearts.map((id, idx) => (
          <div
            key={id}
            className="pointer-events-none absolute -top-4 z-30"
            style={{
              left: `${42 + (idx % 3) * 14}%`,
              animation: "ks-float-up 1s ease-out forwards",
            }}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#fb923c]">
              <path d="M12 21s-7-4.4-9.2-8.5C1.2 9.4 3.2 5.5 7 5.5c2.1 0 3.8 1.2 5 2.8 1.2-1.6 2.9-2.8 5-2.8 3.8 0 5.8 3.9 4.2 7C19 16.6 12 21 12 21z" />
            </svg>
          </div>
        ))}

        <svg
          viewBox="0 0 360 440"
          className="w-[300px] sm:w-[335px] h-auto overflow-visible drop-shadow-[0_14px_24px_rgba(92,130,178,0.2)]"
        >
          <defs>
            {/* Storybook Paper-Cream Body Shading */}
            <linearGradient id="ksBody2d" x1="0.2" y1="0" x2="0.85" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="72%" stopColor="#f8fbff" />
              <stop offset="100%" stopColor="#e6f0fb" />
            </linearGradient>
            <radialGradient id="ksNose2d" cx="38%" cy="32%" r="65%">
              <stop offset="0%" stopColor="#353942" />
              <stop offset="45%" stopColor="#1d2026" />
              <stop offset="100%" stopColor="#121418" />
            </radialGradient>
            <radialGradient id="ksBlush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fda4af" stopOpacity="0.58" />
              <stop offset="100%" stopColor="#fda4af" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ground Contact Shadow */}
          {!isBagCharmMode && (
            <ellipse cx="180" cy="398" rx="84" ry="15" fill="#8bb6e8" opacity="0.38" />
          )}

          {/* Optional Bag Charm Braided Strap & Clasp */}
          {isBagCharmMode && (
            <g>
              <circle
                cx="180"
                cy="24"
                r="18"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="7"
              />
              <rect x="173" y="38" width="14" height="58" rx="7" fill="#4f8ff0" />
            </g>
          )}

          {/* Squish / Breathe Wrapper */}
          <g
            style={{
              transformOrigin: "180px 350px",
              transition: "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              transform:
                squish === "pat"
                  ? "scale(1.07, 0.92) translateY(8px)"
                  : squish === "nose"
                  ? "scale(1.03, 0.97)"
                  : "scale(1, 1)",
            }}
          >
            <g
              style={{
                transformOrigin: "180px 340px",
                animation: "ks-breathe 3.4s ease-in-out infinite",
              }}
            >
              {/* Wagging White Pom-Pom Tail peeking out on lower-left */}
              <g
                style={{
                  transformOrigin: "112px 302px",
                  animation: "ks-tail 2.4s ease-in-out infinite",
                }}
              >
                <circle
                  cx="88"
                  cy="298"
                  r="25"
                  fill="#f3f8ff"
                  stroke="#cfdff2"
                  strokeWidth="3"
                />
              </g>

              {/* Standing Slender Black Legs & Rounded Shoes */}
              <g>
                {/* Left Leg */}
                <rect x="136" y="318" width="22" height="72" rx="11" fill="#1e2026" />
                <ellipse cx="143" cy="390" rx="20" ry="11" fill="#181a1f" />
                <ellipse cx="137" cy="387" rx="6" ry="2.5" fill="#3a3f4b" opacity="0.55" />

                {/* Right Leg */}
                <rect x="202" y="318" width="22" height="72" rx="11" fill="#1e2026" />
                <ellipse cx="217" cy="390" rx="20" ry="11" fill="#181a1f" />
                <ellipse cx="222" cy="387" rx="6" ry="2.5" fill="#3a3f4b" opacity="0.55" />
              </g>

              {/* Idle Side Arms (when NOT stacking snowballs) */}
              {!isStackingSnow && (
                <g>
                  {/* Left Curved Black Arm + 3 Little Fingers */}
                  <path
                    d="M104 216 Q82 252 89 294"
                    fill="none"
                    stroke="#1e2026"
                    strokeWidth="18"
                    strokeLinecap="round"
                  />
                  <circle cx="95" cy="296" r="6.5" fill="#1e2026" />
                  <circle cx="88" cy="303" r="6.5" fill="#1e2026" />
                  <circle cx="82" cy="298" r="6" fill="#1e2026" />

                  {/* Right Curved Black Arm + 3 Little Fingers */}
                  <path
                    d="M256 216 Q278 252 271 294"
                    fill="none"
                    stroke="#1e2026"
                    strokeWidth="18"
                    strokeLinecap="round"
                  />
                  <circle cx="265" cy="296" r="6.5" fill="#1e2026" />
                  <circle cx="272" cy="303" r="6.5" fill="#1e2026" />
                  <circle cx="278" cy="298" r="6" fill="#1e2026" />
                </g>
              )}

              {/* Codfish Snack held in Right Hand if equipped */}
              {eq.includes("codfish_plush") && !isStackingSnow && (
                <g transform="translate(268, 296) rotate(18)">
                  <ellipse cx="14" cy="0" rx="18" ry="10" fill="#7dd3fc" stroke="#38bdf8" strokeWidth="2.5" />
                  <polygon points="30,0 42,-9 42,9" fill="#38bdf8" />
                  <circle cx="6" cy="-2" r="2.2" fill="#1e293b" />
                </g>
              )}

              {/* ======================================================= */}
              {/* SEAMLESS ONE-PIECE 2D LIU KANSHAN SILHOUETTE            */}
              {/* ======================================================= */}
              <g onClick={triggerPat} className="cursor-pointer">
                <path
                  d={`
                    M ${134 + earX} 118
                    C ${134 + earX} 74, ${142 + earX} 66, ${152 + earX} 72
                    C ${160 + earX} 77, ${166 + earX} 98, 171 114
                    Q 180 112, 189 114
                    C ${194 + earX} 98, ${200 + earX} 77, ${208 + earX} 72
                    C ${218 + earX} 66, ${226 + earX} 74, ${226 + earX} 118
                    C 246 154, 266 226, 266 276
                    C 266 322, 232 338, 180 338
                    C 128 338, 94 322, 94 276
                    C 94 226, 114 154, ${134 + earX} 118
                    Z
                  `}
                  fill="url(#ksBody2d)"
                  stroke="#cfe0f5"
                  strokeWidth="3.2"
                  strokeLinejoin="round"
                />

                {/* Subtle Belly Highlight Arc */}
                <path
                  d="M122 298 Q180 326 238 298"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity="0.7"
                />
              </g>

              {/* Soft Watercolor Cheek Blush */}
              <circle
                cx={122 + faceX * 0.6}
                cy={192 + faceY * 0.6}
                r="18"
                fill="url(#ksBlush)"
                opacity={isSmiling ? 0.95 : 0.5}
              />
              <circle
                cx={238 + faceX * 0.6}
                cy={192 + faceY * 0.6}
                r="18"
                fill="url(#ksBlush)"
                opacity={isSmiling ? 0.95 : 0.5}
              />

              {/* ======================================================= */}
              {/* EYES + ICONIC BIG OVAL BLACK NOSE (Parallax Tracked!)   */}
              {/* ======================================================= */}
              <g
                transform={`translate(${faceX}, ${faceY})`}
                onClick={triggerPat}
                className="cursor-pointer"
              >
                {isSmiling ? (
                  <>
                    <path
                      d="M122 169 Q130 158 138 169"
                      fill="none"
                      stroke="#1b1d22"
                      strokeWidth="4.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M222 169 Q230 158 238 169"
                      fill="none"
                      stroke="#1b1d22"
                      strokeWidth="4.6"
                      strokeLinecap="round"
                    />
                  </>
                ) : isBlinking ? (
                  <>
                    <line
                      x1="123"
                      y1="167"
                      x2="137"
                      y2="167"
                      stroke="#1b1d22"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <line
                      x1="223"
                      y1="167"
                      x2="237"
                      y2="167"
                      stroke="#1b1d22"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </>
                ) : (
                  <>
                    {/* Official Small Black Oval Bead Eyes with Tiny Sparkle */}
                    <ellipse cx="130" cy="166" rx="6.2" ry="8.2" fill="#181a1f" />
                    <circle cx="128" cy="163" r="2" fill="#ffffff" />

                    <ellipse cx="230" cy="166" rx="6.2" ry="8.2" fill="#181a1f" />
                    <circle cx="228" cy="163" r="2" fill="#ffffff" />
                  </>
                )}

                {/* Optional Thick Black-Frame Glasses */}
                {eq.includes("thick_glasses") && (
                  <g fill="none" stroke="#232b3a" strokeWidth="5.5">
                    <rect x="108" y="146" width="44" height="36" rx="12" fill="#ffffff" fillOpacity="0.22" />
                    <rect x="208" y="146" width="44" height="36" rx="12" fill="#ffffff" fillOpacity="0.22" />
                    <path d="M152 160 Q180 144 208 160" strokeLinecap="round" />
                  </g>
                )}
              </g>

              {/* Soft Snout Shadow Under Nose */}
              <ellipse
                cx={180 + noseX * 0.7}
                cy={186 + noseY * 0.7}
                rx="38"
                ry="24"
                fill="#dce9f9"
                opacity="0.65"
                className="pointer-events-none"
              />

              {/* Iconic Big Plump Horizontal-Oval Black Nose (Hold to Whisper!) */}
              <g
                transform={`translate(${noseX}, ${noseY})`}
                onPointerDown={handleNoseDown}
                onPointerUp={handleNoseUp}
                className="cursor-pointer"
              >
                {/* Gentle Voice Ripple Ring when Recording */}
                {isRecordingNose && (
                  <ellipse
                    cx="180"
                    cy="172"
                    rx="48"
                    ry="37"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="3.5"
                    strokeDasharray="6 6"
                  />
                )}
                <ellipse cx="180" cy="172" rx="35" ry="26" fill="url(#ksNose2d)" />
                {/* Signature Storybook Bean Highlight on Nose */}
                <ellipse
                  cx="168"
                  cy="161"
                  rx="9.5"
                  ry="4.8"
                  transform="rotate(-18 168 161)"
                  fill="#ffffff"
                  opacity="0.26"
                />
              </g>

              {/* ======================================================= */}
              {/* 2D FITTED WARDROBE ACCESSORIES                          */}
              {/* ======================================================= */}
              {/* Glacier Blue Knitted Scarf */}
              {eq.includes("zhihu_scarf") && (
                <g>
                  <path
                    d="M110 218 Q180 238 250 218 L246 242 Q180 262 114 242 Z"
                    fill="#4f8ff0"
                    stroke="#3b76d4"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="196"
                    y="232"
                    width="28"
                    height="56"
                    rx="10"
                    transform="rotate(-8 196 232)"
                    fill="#3b82f6"
                    stroke="#2f6bc4"
                    strokeWidth="2.2"
                  />
                  <line x1="204" y1="276" x2="224" y2="273" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" />
                </g>
              )}

              {/* Winter Beanie */}
              {eq.includes("camp_beanie") && (
                <g transform={`translate(${earX}, -4)`}>
                  <circle cx="180" cy="58" r="11" fill="#fbbf24" />
                  <path
                    d="M142 104 C144 68, 216 68, 218 104 Z"
                    fill="#263142"
                  />
                  <rect x="138" y="98" width="84" height="14" rx="7" fill="#fbbf24" />
                </g>
              )}

              {/* Pink Fluffy Ear Muffs */}
              {eq.includes("ear_muffs") && (
                <g transform={`translate(${earX}, 0)`}>
                  <path
                    d="M126 116 Q180 82 234 116"
                    fill="none"
                    stroke="#93c5fd"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <circle cx="124" cy="122" r="16" fill="#fda4af" stroke="#fb7185" strokeWidth="2" />
                  <circle cx="236" cy="122" r="16" fill="#fda4af" stroke="#fb7185" strokeWidth="2" />
                </g>
              )}

              {/* ======================================================= */}
              {/* 2D STACKED SNOWBALLS + ARMS HUGGING IN FRONT!           */}
              {/* ======================================================= */}
              {isStackingSnow && !isBagCharmMode && (
                <g onClick={onTapSnowman} className="cursor-pointer">
                  {/* Bottom Snowball */}
                  <circle cx="180" cy="368" r="32" fill="#ffffff" stroke="#cfe2f7" strokeWidth="3" />
                  {/* Middle Snowball */}
                  <circle cx="180" cy="316" r="26" fill="#ffffff" stroke="#cfe2f7" strokeWidth="3" />
                  {/* Top Snowball with Cute Tiny Face */}
                  <circle cx="180" cy="268" r="22" fill="#ffffff" stroke="#cfe2f7" strokeWidth="3" />
                  <circle cx="173" cy="265" r="2.3" fill="#334155" />
                  <circle cx="187" cy="265" r="2.3" fill="#334155" />
                  <polygon points="180,268 190,271 180,274" fill="#fb923c" />

                  {/* Both Black Arms Curving Inward to Hug the Snowballs! */}
                  <path
                    d="M106 226 Q116 274 156 278"
                    fill="none"
                    stroke="#1e2026"
                    strokeWidth="17"
                    strokeLinecap="round"
                  />
                  <path
                    d="M254 226 Q244 274 204 278"
                    fill="none"
                    stroke="#1e2026"
                    strokeWidth="17"
                    strokeLinecap="round"
                  />
                </g>
              )}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
