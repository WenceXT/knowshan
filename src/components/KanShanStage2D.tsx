"use client";

import React, { useEffect, useRef, useState } from "react";
import { HoardedItem, PetState } from "@/types/knowshan";

interface KanShanStage2DProps {
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

function Treasure2DGlyph({ kind }: { kind: string }) {
  if (kind === "fish") {
    return (
      <svg viewBox="0 0 44 44" className="w-11 h-11 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]">
        <ellipse cx="19" cy="22" rx="13" ry="8.5" fill="#7dd3fc" stroke="#ffffff" strokeWidth="2" />
        <polygon points="30,22 40,14 40,30" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="13" cy="20" r="2" fill="#1e293b" />
      </svg>
    );
  }
  if (kind === "card" || kind === "plane") {
    return (
      <svg viewBox="0 0 44 44" className="w-11 h-11 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]">
        <rect
          x="7"
          y="11"
          width="30"
          height="22"
          rx="5"
          transform="rotate(-8 22 22)"
          fill="#fef3c7"
          stroke="#ffffff"
          strokeWidth="2.2"
        />
        <circle cx="22" cy="22" r="4.5" fill="#fb7185" />
      </svg>
    );
  }
  if (kind === "cocoa") {
    return (
      <svg viewBox="0 0 44 44" className="w-11 h-11 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]">
        <rect x="11" y="14" width="20" height="20" rx="6" fill="#fb7185" stroke="#ffffff" strokeWidth="2" />
        <ellipse cx="21" cy="15" rx="9" ry="4" fill="#fffbeb" />
        <path d="M31 18 A4 4 0 0 1 31 28" fill="none" stroke="#ffffff" strokeWidth="2.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 44 44" className="w-11 h-11 drop-shadow-[0_0_8px_rgba(253,224,71,0.95)]">
      <rect x="12" y="11" width="20" height="24" rx="8" fill="#bae6fd" fillOpacity="0.85" stroke="#ffffff" strokeWidth="2" />
      <rect x="16" y="7" width="12" height="5" rx="2.5" fill="#fb7185" />
      <path d="M22 15 L24.2 20.5 L30 21 L25.5 24.8 L26.8 30.5 L22 27.4 L17.2 30.5 L18.5 24.8 L14 21 L19.8 20.5 Z" fill="#fde047" />
    </svg>
  );
}

export default function KanShanStage2D({
  pet,
  hoardedItems,
  isHuntingTreasure,
  isRecordingNose,
  onTapHead,
  onTapNoseStart,
  onTapNoseEnd,
  onTapSnowman,
  onSelectHoardItem,
}: KanShanStage2DProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const [squish, setSquish] = useState<"none" | "pat" | "nose">("none");
  const [hearts, setHearts] = useState<number[]>([]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    setSquish("pat");
    const t = setTimeout(() => setSquish("none"), 320);
    return () => clearTimeout(t);
  }, [pet.equippedItems, pet.snowballProgress, isHuntingTreasure]);

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
  const isSmiling = isHuntingTreasure || pet.mood === "happy" || squish === "pat";

  const faceX = look.x * 7;
  const faceY = look.y * 4;
  const noseX = look.x * 10;
  const noseY = look.y * 5;
  const earX = -look.x * 3;

  // 3 Unobstructed Sparkling Room Positions (Foreground Rug, Right-Front Rug, Inner Sofa Cushion)
  const spotClasses = [
    "left-[42%] bottom-[17%]",
    "right-[11%] bottom-[20%]",
    "left-[20%] top-[47%]",
  ];

  return (
    <div
      ref={stageRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-full h-full overflow-hidden flex items-center justify-center select-none"
    >
      <style>{`
        @keyframes ks-breathe {
          0%, 100% { transform: translateY(0px) scale(1, 1); }
          50% { transform: translateY(-3px) scale(0.992, 1.012); }
        }
        @keyframes ks-tail {
          0%, 100% { transform: rotate(-8deg); }
          50% { transform: rotate(10deg); }
        }
        @keyframes ks-pat-snow {
          0%, 55%, 100% { transform: rotate(0deg); }
          15%, 35% { transform: rotate(22deg); }
          25% { transform: rotate(12deg); }
        }
        @keyframes ks-snow-squish {
          0%, 55%, 100% { transform: scale(1, 1); }
          15%, 35% { transform: scale(1.06, 0.92) translateY(3px); }
          25% { transform: scale(0.99, 1.01); }
        }
        @keyframes ks-float-up {
          0% { opacity: 0.95; transform: translateY(0) scale(0.8); }
          100% { opacity: 0; transform: translateY(-42px) scale(1.15); }
        }
        @keyframes ks-treasure-bob {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-6px) scale(1.06); }
        }
        @keyframes ks-twinkle {
          0%, 100% { opacity: 0.35; transform: scale(0.7) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.25) rotate(20deg); }
        }
      `}</style>

      {/* =============================================================== */}
      {/* 2D STORYBOOK ARCTIC ROOM BACKGROUND                             */}
      {/* =============================================================== */}
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

        <rect x="0" y="0" width="500" height="535" fill="url(#wallGrad2d)" />
        <rect x="0" y="524" width="500" height="14" fill="#eef6ff" opacity="0.85" />
        <rect x="0" y="538" width="500" height="262" fill="url(#floorGrad2d)" />

        {/* Arched Storybook Arctic Window */}
        <g transform="translate(318, 212)">
          <path
            d="M10 120 L10 52 A46 46 0 0 1 102 52 L102 120 Z"
            fill="url(#nightWindow)"
            stroke="#f4f9ff"
            strokeWidth="7"
            strokeLinejoin="round"
          />
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
          <line x1="56" y1="8" x2="56" y2="120" stroke="#f4f9ff" strokeWidth="4.5" />
          <line x1="10" y1="68" x2="102" y2="68" stroke="#f4f9ff" strokeWidth="4.5" />
          <rect x="2" y="116" width="108" height="11" rx="5.5" fill="#ffffff" />
        </g>

        <polygon points="60,0 265,0 385,538 120,538" fill="#ffffff" opacity="0.22" />

        {/* 2D Shell Sofa */}
        <g transform="translate(26, 368)">
          <ellipse cx="110" cy="182" rx="96" ry="16" fill="#94b9e3" opacity="0.38" />
          <path d="M24 128 C12 72, 42 46, 58 118 Z" fill="url(#shellPetal)" stroke="#9bc2ea" strokeWidth="2" />
          <path d="M50 124 C45 48, 80 28, 92 118 Z" fill="#cbe3fb" stroke="#9bc2ea" strokeWidth="2" />
          <path d="M84 122 C86 36, 128 36, 130 122 Z" fill="url(#shellPetal)" stroke="#9bc2ea" strokeWidth="2" />
          <path d="M122 118 C134 28, 170 48, 164 124 Z" fill="#cbe3fb" stroke="#9bc2ea" strokeWidth="2" />
          <path d="M154 118 C170 46, 200 72, 188 128 Z" fill="url(#shellPetal)" stroke="#9bc2ea" strokeWidth="2" />
          <rect x="18" y="126" width="180" height="48" rx="24" fill="#a8ccf0" stroke="#93bbe6" strokeWidth="2" />
          <ellipse cx="108" cy="128" rx="84" ry="20" fill="#e4f1fe" />
          <circle cx="24" cy="124" r="16" fill="#c5e0fa" />
          <circle cx="192" cy="124" r="16" fill="#c5e0fa" />
        </g>

        {/* 2D Giant Paw Rug */}
        <g transform="translate(250, 596)">
          <ellipse cx="0" cy="14" rx="196" ry="52" fill="#8ec1f6" stroke="#7ab3ef" strokeWidth="2.5" />
          <ellipse cx="-146" cy="-24" rx="44" ry="20" transform="rotate(-12 -146 -24)" fill="#8ec1f6" stroke="#7ab3ef" strokeWidth="2" />
          <ellipse cx="-144" cy="-23" rx="29" ry="13" transform="rotate(-12 -144 -23)" fill="#f9fcff" />
          <ellipse cx="-54" cy="-46" rx="46" ry="20" transform="rotate(-4 -54 -46)" fill="#8ec1f6" stroke="#7ab3ef" strokeWidth="2" />
          <ellipse cx="-54" cy="-45" rx="31" ry="13" transform="rotate(-4 -54 -45)" fill="#f9fcff" />
          <ellipse cx="54" cy="-46" rx="46" ry="20" transform="rotate(4 54 -46)" fill="#8ec1f6" stroke="#7ab3ef" strokeWidth="2" />
          <ellipse cx="54" cy="-45" rx="31" ry="13" transform="rotate(4 54 -45)" fill="#f9fcff" />
          <ellipse cx="146" cy="-24" rx="44" ry="20" transform="rotate(12 146 -24)" fill="#8ec1f6" stroke="#7ab3ef" strokeWidth="2" />
          <ellipse cx="144" cy="-23" rx="29" ry="13" transform="rotate(12 144 -23)" fill="#f9fcff" />
          <ellipse cx="0" cy="15" rx="154" ry="39" fill="#f9fcff" />
        </g>
      </svg>

      {/* =============================================================== */}
      {/* 2D SPARKLING SCATTERED TREASURES IN ROOM!                       */}
      {/* =============================================================== */}
      {hoardedItems.slice(0, 3).map((item, idx) => (
        <button
          key={item.id}
          onClick={() => onSelectHoardItem(item)}
          className={`group absolute ${spotClasses[idx]} z-20 flex flex-col items-center cursor-pointer`}
          style={{
            animation: `ks-treasure-bob ${2.6 + idx * 0.35}s ease-in-out infinite`,
          }}
        >
          {/* Warm Golden Shimmer Aura */}
          <div className="relative flex items-center justify-center">
            <span className="absolute w-14 h-14 rounded-full bg-amber-200/65 blur-md group-hover:bg-amber-300/85 transition" />
            {/* Twinkling 4-Point Stars */}
            <svg
              viewBox="0 0 20 20"
              className="absolute -top-2 -right-2 w-4 h-4 fill-[#fef08a]"
              style={{ animation: "ks-twinkle 1.6s ease-in-out infinite" }}
            >
              <path d="M10 0 L12.2 7.8 L20 10 L12.2 12.2 L10 20 L7.8 12.2 L0 10 L7.8 7.8 Z" />
            </svg>
            <svg
              viewBox="0 0 20 20"
              className="absolute -bottom-1 -left-2 w-3.5 h-3.5 fill-white"
              style={{ animation: "ks-twinkle 2.1s ease-in-out 0.6s infinite" }}
            >
              <path d="M10 0 L12.2 7.8 L20 10 L12.2 12.2 L10 20 L7.8 12.2 L0 10 L7.8 7.8 Z" />
            </svg>
            <Treasure2DGlyph kind={item.emoji} />
          </div>
          <span className="mt-0.5 px-2 py-0.5 rounded-full bg-[#fdfbf7]/90 shadow-2xs text-[11px] font-bold text-[#784315] whitespace-nowrap">
            {item.itemName}
          </span>
        </button>
      ))}

      {/* =============================================================== */}
      {/* INTERACTIVE 2D STORYBOOK LIU KANSHAN                            */}
      {/* =============================================================== */}
      <div className="relative z-10 mt-14 flex items-center justify-center">
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
          className="w-[218px] sm:w-[242px] mt-10 h-auto overflow-visible drop-shadow-[0_12px_22px_rgba(92,130,178,0.18)]"
        >
          <defs>
            <linearGradient id="ksBody2d" x1="0.2" y1="0" x2="0.85" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="72%" stopColor="#f8fbff" />
              <stop offset="100%" stopColor="#e6f0fb" />
            </linearGradient>
            <radialGradient id="ksNose2d" cx="38%" cy="32%" r="65%">
              <stop offset="0%" stopColor="#465268" />
              <stop offset="55%" stopColor="#323c4f" />
              <stop offset="100%" stopColor="#262e3e" />
            </radialGradient>
            <radialGradient id="ksBlush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fda4af" stopOpacity="0.58" />
              <stop offset="100%" stopColor="#fda4af" stopOpacity="0" />
            </radialGradient>
          </defs>

          <ellipse cx="180" cy="396" rx="88" ry="15" fill="#8bb6e8" opacity="0.38" />

          <g
            style={{
              transformOrigin: "180px 350px",
              transition: "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              transform:
                squish === "pat" || isHuntingTreasure
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
              {/* Tail */}
              <g
                style={{
                  transformOrigin: "112px 322px",
                  animation: "ks-tail 2.4s ease-in-out infinite",
                }}
              >
                <circle
                  cx="88"
                  cy="322"
                  r="25"
                  fill="#f3f8ff"
                  stroke="#cfdff2"
                  strokeWidth="3"
                />
              </g>

              {/* Autonomous Snowman Stacking Side Arms */}
              <g>
                <g
                  style={{
                    transformOrigin: "100px 236px",
                    animation: "ks-pat-snow 4.8s ease-in-out infinite",
                  }}
                >
                  <path
                    d="M100 236 Q66 264 56 304"
                    fill="none"
                    stroke="#333e52"
                    strokeWidth="22"
                    strokeLinecap="round"
                  />
                </g>
                <path
                  d="M260 236 Q282 278 274 332"
                  fill="none"
                  stroke="#333e52"
                  strokeWidth="22"
                  strokeLinecap="round"
                />
              </g>

              {/* Codfish Snack */}
              {eq.includes("codfish_plush") && (
                <g transform="translate(272, 326) rotate(18)">
                  <ellipse cx="14" cy="0" rx="18" ry="10" fill="#7dd3fc" stroke="#38bdf8" strokeWidth="2.5" />
                  <polygon points="30,0 42,-9 42,9" fill="#38bdf8" />
                  <circle cx="6" cy="-2" r="2.2" fill="#1e293b" />
                </g>
              )}

              {/* Chubby Sitting Body */}
              <g onClick={triggerPat} className="cursor-pointer">
                <path
                  d={`
                    M ${122 + earX} 132
                    C ${120 + earX} 82, ${134 + earX} 70, ${148 + earX} 78
                    C ${158 + earX} 84, ${164 + earX} 106, 168 122
                    Q 180 120, 192 122
                    C ${196 + earX} 106, ${202 + earX} 84, ${212 + earX} 78
                    C ${226 + earX} 70, ${240 + earX} 82, ${238 + earX} 132
                    C 262 172, 272 246, 272 318
                    C 272 366, 236 382, 180 382
                    C 124 382, 88 366, 88 318
                    C 88 246, 98 172, ${122 + earX} 132
                    Z
                  `}
                  fill="url(#ksBody2d)"
                  stroke="#cfe0f5"
                  strokeWidth="3.2"
                  strokeLinejoin="round"
                />

                {/* Cute Chubby White Sitting Feet */}
                <rect x="122" y="346" width="38" height="46" rx="19" fill="#ffffff" stroke="#cfe0f5" strokeWidth="3" />
                <rect x="200" y="346" width="38" height="46" rx="19" fill="#ffffff" stroke="#cfe0f5" strokeWidth="3" />
              </g>

              {/* Blush */}
              <circle
                cx={118 + faceX * 0.6}
                cy={212 + faceY * 0.6}
                r="16"
                fill="url(#ksBlush)"
                opacity={isSmiling ? 0.9 : 0.4}
              />
              <circle
                cx={242 + faceX * 0.6}
                cy={212 + faceY * 0.6}
                r="16"
                fill="url(#ksBlush)"
                opacity={isSmiling ? 0.9 : 0.4}
              />

              {/* Eyes + Continuous-Brow Glasses */}
              <g
                transform={`translate(${faceX}, ${faceY})`}
                onClick={triggerPat}
                className="cursor-pointer"
              >
                {isSmiling ? (
                  <>
                    <path
                      d="M122 188 Q130 177 138 188"
                      fill="none"
                      stroke="#252e3f"
                      strokeWidth="4.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M222 188 Q230 177 238 188"
                      fill="none"
                      stroke="#252e3f"
                      strokeWidth="4.6"
                      strokeLinecap="round"
                    />
                  </>
                ) : isBlinking ? (
                  <>
                    <line x1="124" y1="186" x2="136" y2="186" stroke="#252e3f" strokeWidth="4" strokeLinecap="round" />
                    <line x1="224" y1="186" x2="236" y2="186" stroke="#252e3f" strokeWidth="4" strokeLinecap="round" />
                  </>
                ) : (
                  <>
                    <ellipse cx="130" cy="186" rx="4.8" ry="6.4" fill="#1e2532" />
                    <ellipse cx="230" cy="186" rx="4.8" ry="6.4" fill="#1e2532" />
                  </>
                )}

                {eq.includes("thick_glasses") && (
                  <g fill="none" stroke="#313b4e" strokeWidth="6.5">
                    <rect x="102" y="166" width="54" height="40" rx="11" fill="#ffffff" fillOpacity="0.2" />
                    <rect x="204" y="166" width="54" height="40" rx="11" fill="#ffffff" fillOpacity="0.2" />
                    <path d="M104 167 Q180 160 256 167" strokeWidth="7" strokeLinecap="round" />
                  </g>
                )}
              </g>

              {/* Nose */}
              <g
                transform={`translate(${noseX}, ${noseY})`}
                onPointerDown={handleNoseDown}
                onPointerUp={handleNoseUp}
                className="cursor-pointer"
              >
                {isRecordingNose && (
                  <ellipse
                    cx="180"
                    cy="202"
                    rx="48"
                    ry="40"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="3.5"
                    strokeDasharray="6 6"
                  />
                )}
                <ellipse cx="180" cy="202" rx="34" ry="29" fill="url(#ksNose2d)" />
              </g>

              {/* Scarf */}
              {eq.includes("zhihu_scarf") && (
                <g>
                  <path
                    d="M98 242 Q180 262 262 242 L258 268 Q180 288 102 268 Z"
                    fill="#4f8ff0"
                    stroke="#3b76d4"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="196"
                    y="256"
                    width="28"
                    height="56"
                    rx="10"
                    transform="rotate(-8 196 256)"
                    fill="#3b82f6"
                    stroke="#2f6bc4"
                    strokeWidth="2.2"
                  />
                </g>
              )}

              {/* Beanie */}
              {eq.includes("camp_beanie") && (
                <g transform={`translate(${earX}, 8)`}>
                  <circle cx="180" cy="64" r="11" fill="#fbbf24" />
                  <path d="M144 108 C146 74, 214 74, 216 108 Z" fill="#313b4e" />
                  <rect x="140" y="102" width="80" height="14" rx="7" fill="#fbbf24" />
                </g>
              )}

              {/* Earmuffs */}
              {eq.includes("ear_muffs") && (
                <g transform={`translate(${earX}, 10)`}>
                  <path d="M118 122 Q180 88 242 122" fill="none" stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" />
                  <circle cx="116" cy="128" r="16" fill="#fda4af" stroke="#fb7185" strokeWidth="2" />
                  <circle cx="244" cy="128" r="16" fill="#fda4af" stroke="#fb7185" strokeWidth="2" />
                </g>
              )}

              {/* Self-Stacked Snowman Beside Liu Kanshan ("他自己在那堆") */}
              <g onClick={onTapSnowman} className="cursor-pointer">
                <circle cx="38" cy="376" r="28" fill="#ffffff" stroke="#cfe2f7" strokeWidth="3" />
                <circle cx="40" cy="332" r="22" fill="#ffffff" stroke="#cfe2f7" strokeWidth="3" />
                <g
                  style={{
                    transformOrigin: "42px 296px",
                    animation: "ks-snow-squish 4.8s ease-in-out infinite",
                  }}
                >
                  <circle cx="42" cy="294" r="18" fill="#ffffff" stroke="#cfe2f7" strokeWidth="3" />
                </g>
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
