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
      <svg viewBox="0 0 44 44" className="w-9 h-9">
        <ellipse cx="19" cy="22" rx="12" ry="7.8" fill="#7dd3fc" stroke="#ffffff" strokeWidth="2" />
        <polygon points="30,22 39,15 39,29" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="13" cy="20" r="1.8" fill="#1e293b" />
      </svg>
    );
  }
  if (kind === "card" || kind === "plane") {
    return (
      <svg viewBox="0 0 44 44" className="w-9 h-9">
        <rect
          x="8"
          y="12"
          width="28"
          height="20"
          rx="5"
          transform="rotate(-7 22 22)"
          fill="#fef3c7"
          stroke="#ffffff"
          strokeWidth="2"
        />
        <circle cx="22" cy="22" r="4" fill="#fb7185" />
      </svg>
    );
  }
  if (kind === "cocoa") {
    return (
      <svg viewBox="0 0 44 44" className="w-9 h-9">
        <rect x="12" y="15" width="18" height="18" rx="5.5" fill="#fb7185" stroke="#ffffff" strokeWidth="2" />
        <ellipse cx="21" cy="16" rx="8" ry="3.5" fill="#fffbeb" />
        <path d="M30 18 A3.8 3.8 0 0 1 30 27" fill="none" stroke="#ffffff" strokeWidth="2.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 44 44" className="w-9 h-9">
      <rect x="13" y="12" width="18" height="22" rx="7" fill="#bae6fd" fillOpacity="0.88" stroke="#ffffff" strokeWidth="2" />
      <rect x="16.5" y="8" width="11" height="4.5" rx="2.2" fill="#fb7185" />
      <path d="M22 16 L24 20.5 L29 21 L25 24.4 L26.2 29.2 L22 26.6 L17.8 29.2 L19 24.4 L15 21 L20 20.5 Z" fill="#fde047" />
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
  const [ambientExtra, setAmbientExtra] = useState(0);
  const [idleMode, setIdleMode] = useState<"pat" | "wave" | "sway">("pat");
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if ((pet.snowballProgress || 20) <= 18) setAmbientExtra(0);
  }, [pet.snowballProgress]);

  useEffect(() => {
    const iv = setInterval(() => {
      setAmbientExtra((prev) => Math.min(82, prev + 6));
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  // Cycle rich 2D idle states (patting snowball -> waving 4-finger hand -> happy step sway)
  useEffect(() => {
    const modes: ("pat" | "wave" | "sway")[] = ["pat", "wave", "sway"];
    let idx = 0;
    const iv = setInterval(() => {
      idx = (idx + 1) % modes.length;
      setIdleMode(modes[idx]);
    }, 5200);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = 2600 + Math.random() * 2000;
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
  const isSmiling =
    isHuntingTreasure || pet.mood === "happy" || squish === "pat" || idleMode === "sway";
  const effectiveSnow = Math.min(100, (pet.snowballProgress || 20) + ambientExtra);
  const snowTier = effectiveSnow >= 80 ? 3 : effectiveSnow >= 48 ? 2 : 1;

  const faceX = look.x * 5;
  const faceY = look.y * 3;

  const spotClasses = [
    "left-[46%] bottom-[16%]",
    "right-[12%] bottom-[19%]",
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
          50% { transform: translateY(-3px) scale(0.993, 1.012); }
        }
        @keyframes ks-sway-dance {
          0%, 100% { transform: rotate(-2.2deg) translateY(0px); }
          50% { transform: rotate(2.4deg) translateY(-4px); }
        }
        @keyframes ks-tail {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(12deg); }
        }
        @keyframes ks-pat-snow {
          0%, 55%, 100% { transform: rotate(0deg); }
          15%, 35% { transform: rotate(10deg); }
          25% { transform: rotate(4deg); }
        }
        @keyframes ks-wave-hi {
          0%, 100% { transform: rotate(118deg); }
          50% { transform: rotate(138deg); }
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
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        @keyframes ks-twinkle {
          0%, 100% { opacity: 0.3; transform: scale(0.7); }
          50% { opacity: 0.95; transform: scale(1.15); }
        }
      `}</style>

      {/* 2D ARCTIC ROOM BACKGROUND */}
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
            <stop offset="100%" stopColor="#bad5f5" />
          </linearGradient>
          <linearGradient id="shellPetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8f3ff" />
            <stop offset="100%" stopColor="#b8d6f6" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="500" height="545" fill="url(#wallGrad2d)" />
        <rect x="0" y="538" width="500" height="262" fill="url(#floorGrad2d)" />
        <rect x="0" y="532" width="500" height="10" fill="#eef6ff" opacity="0.85" />
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

      {/* SUBTLE LOW-KEY ROOM TREASURES */}
      {hoardedItems.slice(0, 3).map((item, idx) => (
        <button
          key={item.id}
          onClick={() => onSelectHoardItem(item)}
          className={`group absolute ${spotClasses[idx]} z-20 flex flex-col items-center cursor-pointer opacity-90 hover:opacity-100 transition`}
          style={{
            animation: `ks-treasure-bob ${3.2 + idx * 0.4}s ease-in-out infinite`,
          }}
        >
          <div className="relative flex items-center justify-center scale-90">
            <span className="absolute w-9 h-9 rounded-full bg-amber-200/35 blur-sm group-hover:bg-amber-200/60 transition" />
            <svg
              viewBox="0 0 20 20"
              className="absolute -top-1 -right-1 w-2.5 h-2.5 fill-[#fef08a]"
              style={{ animation: "ks-twinkle 2.2s ease-in-out infinite" }}
            >
              <path d="M10 0 L12.2 7.8 L20 10 L12.2 12.2 L10 20 L7.8 12.2 L0 10 L7.8 7.8 Z" />
            </svg>
            <Treasure2DGlyph kind={item.emoji} />
          </div>
          <span className="px-1.5 py-0.5 rounded-full bg-[#fdfbf7]/80 text-[10px] font-semibold text-[#784315]/85 whitespace-nowrap">
            {item.itemName}
          </span>
        </button>
      ))}

      {/* STANDING 2D LIU KANSHAN (Matching Reference Photos 1–4!) */}
      <div className="relative z-10 mt-10 flex items-center justify-center">
        {hearts.map((id, idx) => (
          <div
            key={id}
            className="pointer-events-none absolute -top-2 z-30"
            style={{
              left: `${45 + (idx % 3) * 12}%`,
              animation: "ks-float-up 1s ease-out forwards",
            }}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#fb923c]">
              <path d="M12 21s-7-4.4-9.2-8.5C1.2 9.4 3.2 5.5 7 5.5c2.1 0 3.8 1.2 5 2.8 1.2-1.6 2.9-2.8 5-2.8 3.8 0 5.8 3.9 4.2 7C19 16.6 12 21 12 21z" />
            </svg>
          </div>
        ))}

        <svg
          viewBox="0 0 380 460"
          className="w-[240px] sm:w-[264px] mt-8 h-auto overflow-visible drop-shadow-[0_12px_20px_rgba(92,130,178,0.16)]"
        >
          <defs>
            <linearGradient id="ksBody2d" x1="0.15" y1="0" x2="0.85" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="76%" stopColor="#f8fbff" />
              <stop offset="100%" stopColor="#e6f0fb" />
            </linearGradient>
          </defs>

          {/* Ground shadows */}
          <ellipse cx="222" cy="418" rx="68" ry="12" fill="#8bb6e8" opacity="0.34" />
          <ellipse cx="66" cy="410" rx="46" ry="9" fill="#8bb6e8" opacity="0.28" />

          {/* Bigger Progressive 1 -> 2 -> 3 Snowballs on Left Rug */}
          <g onClick={onTapSnowman} className="cursor-pointer">
            <g
              style={{
                transformOrigin: "66px 386px",
                animation:
                  snowTier === 1 && idleMode === "pat"
                    ? "ks-snow-squish 4.2s ease-in-out infinite"
                    : undefined,
              }}
            >
              <ellipse cx="66" cy="386" rx="36" ry="30" fill="#ffffff" stroke="#cfe2f7" strokeWidth="3" />
            </g>
            {snowTier >= 2 && (
              <g
                style={{
                  transformOrigin: "66px 334px",
                  animation:
                    snowTier === 2 && idleMode === "pat"
                      ? "ks-snow-squish 4.2s ease-in-out infinite"
                      : undefined,
                }}
              >
                <ellipse cx="66" cy="334" rx="28" ry="24" fill="#ffffff" stroke="#cfe2f7" strokeWidth="3" />
              </g>
            )}
            {snowTier >= 3 && (
              <g
                style={{
                  transformOrigin: "66px 290px",
                  animation:
                    idleMode === "pat" ? "ks-snow-squish 4.2s ease-in-out infinite" : undefined,
                }}
              >
                <circle cx="66" cy="290" r="20" fill="#ffffff" stroke="#cfe2f7" strokeWidth="3" />
                <circle cx="60" cy="288" r="2.4" fill="#1e2430" />
                <circle cx="72" cy="288" r="2.4" fill="#1e2430" />
              </g>
            )}
          </g>

          {/* Standing Liu Kanshan Group (3/4 Photo-4 Silhouette!) */}
          <g
            style={{
              transformOrigin: "220px 380px",
              transition: "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              transform:
                squish === "pat" || isHuntingTreasure
                  ? "scale(1.06, 0.93) translateY(8px)"
                  : "scale(1, 1)",
            }}
          >
            <g
              style={{
                transformOrigin: "220px 380px",
                animation:
                  idleMode === "sway"
                    ? "ks-sway-dance 1.8s ease-in-out infinite"
                    : "ks-breathe 3.4s ease-in-out infinite",
              }}
            >
              {/* Round White Pom-Pom Tail at Lower Back (Photo 3 & 4!) */}
              <g
                style={{
                  transformOrigin: "156px 298px",
                  animation: "ks-tail 2.1s ease-in-out infinite",
                }}
              >
                <circle
                  cx="134"
                  cy="300"
                  r="24"
                  fill="#f6faff"
                  stroke="#cfdff2"
                  strokeWidth="3"
                />
              </g>

              {/* Sturdy Charcoal-Black Standing Legs + Plump Rounded Boots! */}
              <g fill="#1f242e">
                {/* Left leg & boot */}
                <rect x="184" y="338" width="22" height="68" rx="10" />
                <ellipse cx="198" cy="408" rx="20" ry="13" />
                {/* Right leg & boot */}
                <rect x="234" y="338" width="22" height="68" rx="10" />
                <ellipse cx="250" cy="408" rx="21" ry="13" />
              </g>

              {/* Left Charcoal Arm + 4-Fingered Hand (Waves in Photo-4 pose or pats air beside snow!) */}
              <g
                style={{
                  transformOrigin: "162px 226px",
                  animation:
                    idleMode === "wave"
                      ? "ks-wave-hi 1.2s ease-in-out infinite"
                      : "ks-pat-snow 4.2s ease-in-out infinite",
                }}
              >
                <path
                  d="M162 226 Q134 256 130 296"
                  fill="none"
                  stroke="#1f242e"
                  strokeWidth="17"
                  strokeLinecap="round"
                />
                <circle cx="129" cy="300" r="11" fill="#1f242e" />
                <circle cx="138" cy="295" r="4.5" fill="#1f242e" />
                <circle cx="121" cy="307" r="4.2" fill="#1f242e" />
                <circle cx="128" cy="310" r="4.2" fill="#1f242e" />
                <circle cx="135" cy="308" r="4.2" fill="#1f242e" />
              </g>

              {/* Right Charcoal Arm + 4-Fingered Hand */}
              <g>
                <path
                  d="M278 232 Q294 268 290 310"
                  fill="none"
                  stroke="#1f242e"
                  strokeWidth="17"
                  strokeLinecap="round"
                />
                <circle cx="289" cy="314" r="10.5" fill="#1f242e" />
                <circle cx="282" cy="321" r="4" fill="#1f242e" />
                <circle cx="289" cy="323" r="4" fill="#1f242e" />
                <circle cx="296" cy="320" r="4" fill="#1f242e" />
              </g>

              {/* Codfish Snack */}
              {eq.includes("codfish_plush") && (
                <g transform="translate(292, 316) rotate(18)">
                  <ellipse cx="12" cy="0" rx="16" ry="9" fill="#7dd3fc" stroke="#38bdf8" strokeWidth="2.2" />
                  <polygon points="26,0 37,-8 37,8" fill="#38bdf8" />
                  <circle cx="5" cy="-2" r="2" fill="#1e293b" />
                </g>
              )}

              {/* Tall Pear-Cylinder White Body + Upright Fox Ears + 3/4 Upturned Snout (Photo 4!) */}
              <g onClick={triggerPat} className="cursor-pointer">
                <path
                  d="
                    M 176 116
                    C 174 68, 190 60, 202 74
                    C 210 84, 214 102, 218 112
                    Q 230 110, 240 112
                    C 246 96, 254 70, 266 72
                    C 278 74, 282 98, 278 128
                    C 292 164, 292 246, 288 304
                    C 284 344, 256 356, 220 356
                    C 180 356, 152 342, 152 298
                    C 152 232, 160 162, 176 116
                    Z
                  "
                  fill="url(#ksBody2d)"
                  stroke="#cfe0f5"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />

                {/* Sculpted Upturned Conical Snout Mound (Photo 3 & 4!) */}
                <path
                  d="M 218 152 C 252 146, 294 148, 304 176 C 310 202, 276 222, 232 214"
                  fill="#ffffff"
                  stroke="#d5e4f7"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </g>

              {/* Crisp Oval Bead Eyes */}
              <g transform={`translate(${faceX}, ${faceY})`} onClick={triggerPat} className="cursor-pointer">
                {isSmiling ? (
                  <path
                    d="M192 166 Q200 156 208 166"
                    fill="none"
                    stroke="#1b2029"
                    strokeWidth="4.4"
                    strokeLinecap="round"
                  />
                ) : isBlinking ? (
                  <line x1="194" y1="164" x2="206" y2="164" stroke="#1b2029" strokeWidth="3.8" strokeLinecap="round" />
                ) : (
                  <ellipse cx="200" cy="164" rx="4.8" ry="6.8" fill="#181d26" />
                )}

                {eq.includes("thick_glasses") && (
                  <g fill="none" stroke="#252c3b" strokeWidth="5.5">
                    <rect x="180" y="146" width="40" height="34" rx="9" fill="#ffffff" fillOpacity="0.18" />
                    <line x1="162" y1="158" x2="180" y2="158" strokeLinecap="round" />
                    <path d="M220 156 Q244 148 264 154" strokeLinecap="round" />
                  </g>
                )}
              </g>

              {/* Big Seamless Charcoal-Black Nose Cap at Tip of Snout! */}
              <g
                transform={`translate(${faceX * 1.1}, ${faceY * 1.1})`}
                onPointerDown={handleNoseDown}
                onPointerUp={handleNoseUp}
                className="cursor-pointer"
              >
                {isRecordingNose && (
                  <circle
                    cx="286"
                    cy="176"
                    r="36"
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="3.2"
                    strokeDasharray="6 6"
                  />
                )}
                <ellipse
                  cx="286"
                  cy="176"
                  rx="26"
                  ry="25"
                  transform="rotate(-10 286 176)"
                  fill="#1b2029"
                />
              </g>

              {/* Optional Knitted Scarf */}
              {eq.includes("zhihu_scarf") && (
                <g>
                  <path
                    d="M158 214 Q222 232 282 216 L280 238 Q222 254 160 236 Z"
                    fill="#4a8df8"
                    stroke="#3b76d4"
                    strokeWidth="2.4"
                    strokeLinejoin="round"
                  />
                  <rect
                    x="234"
                    y="228"
                    width="24"
                    height="48"
                    rx="9"
                    transform="rotate(-8 234 228)"
                    fill="#3b82f6"
                    stroke="#2f6bc4"
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* Optional Beanie */}
              {eq.includes("camp_beanie") && (
                <g>
                  <circle cx="228" cy="70" r="9.5" fill="#fbbf24" />
                  <path d="M198 106 C200 78, 256 78, 258 106 Z" fill="#313b4e" />
                  <rect x="195" y="102" width="66" height="12" rx="6" fill="#fbbf24" />
                </g>
              )}

              {/* Optional Earmuffs */}
              {eq.includes("ear_muffs") && (
                <g>
                  <path d="M174 114 Q228 84 278 116" fill="none" stroke="#93c5fd" strokeWidth="5.5" strokeLinecap="round" />
                  <circle cx="172" cy="120" r="14" fill="#fda4af" stroke="#fb7185" strokeWidth="2" />
                  <circle cx="280" cy="120" r="14" fill="#fda4af" stroke="#fb7185" strokeWidth="2" />
                </g>
              )}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
