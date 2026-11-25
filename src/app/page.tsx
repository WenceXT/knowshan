"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AccessoryItem, HoardedItem, KnowShanStore, ZhihuQuestion } from "@/types/knowshan";
import KanShanStage2D from "@/components/KanShanStage2D";
import {
  apiGenerateDraft,
  apiGetState,
  apiPostState,
  apiPublishSnowman,
  apiSendBubble,
  apiSubmitWhisper,
} from "@/lib/client-api";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const KanShanStage3D = dynamic(() => import("@/components/KanShanStage3D"), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

type DrawerType =
  | null
  | "wardrobe"
  | "whisper"
  | "bubble"
  | "diary"
  | "snowman"
  | "treasure"
  | "replies"
  | "settings";

const VOICE_PRESETS = [
  {
    short: "下午汇报忘词了",
    full: "今天下午在新闻学院张老师的传播学专业课做小组 Pre 搞砸了，上台忘词声音都在抖，回宿舍还是好难受……",
  },
  {
    short: "熬到现在还没睡",
    full: "一个人熬到十二点半还没睡，白天装得像没事人一样，其实有点累。",
  },
  {
    short: "写了半天又删了",
    full: "备忘录里攒了好多话，每次点开发布框又默默删掉了。",
  },
];

// Hand-crafted soft vector icons for wardrobe & sparkling hoard items (zero system emojis!)
function ItemVectorIcon({ id }: { id: string }) {
  switch (id) {
    case "thick_glasses":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <rect x="4" y="12" width="12" height="10" rx="4" fill="none" stroke="#2d3748" strokeWidth="3" />
          <rect x="20" y="12" width="12" height="10" rx="4" fill="none" stroke="#2d3748" strokeWidth="3" />
          <path d="M16 16 Q18 14 20 16" fill="none" stroke="#2d3748" strokeWidth="2.8" />
        </svg>
      );
    case "zhihu_scarf":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <rect x="6" y="11" width="24" height="9" rx="4.5" fill="#60a5fa" />
          <rect x="19" y="17" width="8" height="13" rx="3.5" fill="#3b82f6" />
        </svg>
      );
    case "camp_beanie":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <circle cx="18" cy="8" r="3.5" fill="#fbbf24" />
          <path d="M8 24 C8 13 28 13 28 24 Z" fill="#334155" />
          <rect x="7" y="23" width="22" height="4.5" rx="2.2" fill="#fbbf24" />
        </svg>
      );
    case "codfish_plush":
    case "fish":
    case "h-2":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <ellipse cx="16" cy="18" rx="10" ry="6.5" fill="#7dd3fc" />
          <polygon points="25,18 32,12 32,24" fill="#38bdf8" />
          <circle cx="11" cy="16.5" r="1.5" fill="#1e293b" />
          <path d="M27 7 L28 9.5 L30.5 10.5 L28 11.5 L27 14 L26 11.5 L23.5 10.5 L26 9.5 Z" fill="#facc15" />
        </svg>
      );
    case "ear_muffs":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <path d="M8 20 A10 10 0 0 1 28 20" fill="none" stroke="#93c5fd" strokeWidth="3" />
          <circle cx="8" cy="21" r="5" fill="#fda4af" />
          <circle cx="28" cy="21" r="5" fill="#fda4af" />
        </svg>
      );
    case "card":
    case "h-1":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <rect x="7" y="8" width="22" height="20" rx="4" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
          <line x1="12" y1="14" x2="24" y2="14" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          <line x1="12" y1="19" x2="20" y2="19" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          <circle cx="23" cy="21" r="2.8" fill="#fb7185" />
        </svg>
      );
    case "star_jar":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <rect x="13" y="6" width="10" height="4" rx="1.8" fill="#d97706" />
          <rect x="9" y="10" width="18" height="20" rx="6" fill="#dbeafe" stroke="#60a5fa" strokeWidth="2" />
          <path d="M18 14 L19.8 18 L24 18.5 L20.8 21.3 L21.7 25.5 L18 23.3 L14.3 25.5 L15.2 21.3 L12 18.5 L16.2 18 Z" fill="#facc15" />
        </svg>
      );
    case "cocoa":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <rect x="8" y="13" width="17" height="16" rx="5" fill="#fb7185" />
          <ellipse cx="16.5" cy="14" rx="7.5" ry="3" fill="#fffbeb" />
          <path d="M25 16 A4 4 0 0 1 25 25" fill="none" stroke="#fb7185" strokeWidth="2.8" />
          <path d="M14 7 Q15.5 9.5 14 11" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          <path d="M19 6 Q20.5 8.5 19 10.5" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "plane":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <polygon points="5,18 31,8 23,28 17,21" fill="#93c5fd" stroke="#3b82f6" strokeWidth="1.8" strokeLinejoin="round" />
          <line x1="31" y1="8" x2="17" y2="21" stroke="#2563eb" strokeWidth="1.8" />
        </svg>
      );
    case "shell":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <path d="M7 22 C7 11 29 11 29 22 L24 28 L12 28 Z" fill="#fbcfe8" stroke="#f472b6" strokeWidth="2" strokeLinejoin="round" />
          <line x1="18" y1="13" x2="18" y2="27" stroke="#f472b6" strokeWidth="1.6" />
          <line x1="13" y1="15" x2="15" y2="27" stroke="#f472b6" strokeWidth="1.6" />
          <line x1="23" y1="15" x2="21" y2="27" stroke="#f472b6" strokeWidth="1.6" />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <path d="M18 7 A8 8 0 0 0 10 15 L10 22 L7 25 L29 25 L26 22 L26 15 A8 8 0 0 0 18 7 Z" fill="#facc15" stroke="#eab308" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="18" cy="27.5" r="3" fill="#d97706" />
        </svg>
      );
    case "crystal":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <polygon points="18,5 27,15 23,29 13,29 9,15" fill="#a5f3fc" stroke="#38bdf8" strokeWidth="2" strokeLinejoin="round" />
          <polyline points="9,15 18,19 27,15" fill="none" stroke="#0284c7" strokeWidth="1.6" />
          <line x1="18" y1="5" x2="18" y2="29" stroke="#0284c7" strokeWidth="1.6" />
        </svg>
      );
    case "acorn":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <path d="M18 6 L18 10" stroke="#78350f" strokeWidth="2.6" strokeLinecap="round" />
          <ellipse cx="18" cy="13.5" rx="10" ry="4.8" fill="#92400e" />
          <path d="M10 15 C10 26 18 30 18 30 C18 30 26 26 26 15 Z" fill="#f59e0b" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <circle cx="18" cy="18" r="10" fill="#fde047" />
          <circle cx="15" cy="15" r="3" fill="#fef9c3" />
        </svg>
      );
  }
}

export default function CozyKnowShanApp() {
  const [store, setStore] = useState<KnowShanStore | null>(null);
  const [accessories, setAccessories] = useState<AccessoryItem[]>([]);
  const [drawer, setDrawer] = useState<DrawerType>(null);
  const [isHuntingTreasure, setIsHuntingTreasure] = useState(false);
  const [isRecordingNose, setIsRecordingNose] = useState(false);
  const [isFullWindow, setIsFullWindow] = useState(true);
  const [renderMode, setRenderMode] = useState<"3d" | "2d">("3d");
  const [toast, setToast] = useState<string | null>(null);

  const [whisperInput, setWhisperInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedHoard, setSelectedHoard] = useState<HoardedItem | null>(null);

  const [draftInfo, setDraftInfo] = useState<{
    rawDraft: string;
    desensitizedDraft: string;
    redactedTerms: string[];
    question: ZhihuQuestion;
  } | null>(null);
  const [hideNames, setHideNames] = useState(true);
  const [postText, setPostText] = useState("");
  const [copied, setCopied] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2500);
  };

  useEffect(() => {
    apiGetState().then((d) => {
      setStore(d.store);
      setAccessories(d.accessories || []);
      if (d.store?.hoardedItems?.[0]) setSelectedHoard(d.store.hoardedItems[0]);
    });

    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.lang = "zh-CN";
        rec.continuous = true;
        rec.interimResults = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (e: any) => {
          let t = "";
          for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          if (t) setWhisperInput(t);
        };
        recRef.current = rec;
      }
    }
  }, []);

  const postState = async (payload: Record<string, unknown>) => {
    const d = await apiPostState(payload);
    if (d.error) {
      showToast(d.error);
      return null;
    }
    if (d.store) setStore(d.store);
    if (d.accessories) setAccessories(d.accessories);
    return d.store as KnowShanStore | null;
  };

  const handleNoseStart = () => {
    setIsRecordingNose(true);
    showToast("正在听你说悄悄话…");
    try {
      recRef.current?.start();
    } catch {
      // ignore
    }
  };

  const handleNoseEnd = () => {
    if (!isRecordingNose) return;
    setIsRecordingNose(false);
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    setDrawer("whisper");
  };

  const handleFeedCodfish = async () => {
    await postState({ action: "hardware_interact", interactType: "head_pat" });
    showToast("喂了一小块银鳕鱼");
  };

  const handleSelectHoardInRoom = (item: HoardedItem) => {
    setSelectedHoard(item);
    setDrawer("treasure");
  };

  const handleGoOutdoors = async () => {
    if (isHuntingTreasure) return;
    setIsHuntingTreasure(true);
    showToast("看山跑去雪原寻宝啦…");
    const updated = await postState({ action: "refresh_hoard" });
    if (updated?.hoardedItems?.[0]) {
      setSelectedHoard(updated.hoardedItems[0]);
    }
    setTimeout(() => {
      setIsHuntingTreasure(false);
      showToast("叼回三件闪闪发光的新小物件，点地上看看吧");
    }, 850);
  };

  const submitWhisper = async () => {
    if (!whisperInput.trim()) return;
    setBusy(true);
    try {
      const d = await apiSubmitWhisper(whisperInput.trim(), "web_diary");
      if (d.store) {
        setStore(d.store);
        setWhisperInput("");
        setDrawer(null);
        showToast("看山听完拍了拍雪球，冒出了一个新提问");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendChat = async (quick?: string) => {
    if (!store) return;
    const text = (quick ?? chatInput).trim();
    if (!text) return;
    setBusy(true);
    setChatInput("");
    try {
      const d = await apiSendBubble(store.activeQuestionId, text);
      if (d.store) {
        setStore(d.store);
      }
    } finally {
      setBusy(false);
    }
  };

  const openSnowmanLetter = async () => {
    if (!store) return;
    const info = await apiGenerateDraft(store.activeQuestionId);
    setDraftInfo(info);
    setHideNames(true);
    setPostText(info.desensitizedDraft);
    setDrawer("snowman");
  };

  const publishSnowman = async () => {
    if (!draftInfo || !postText.trim()) return;
    setBusy(true);
    try {
      const d = await apiPublishSnowman({
        questionId: draftInfo.question.id,
        content: postText,
        desensitized: hideNames,
        redactedTerms: draftInfo.redactedTerms,
      });
      if (d.store) {
        setStore(d.store);
        setDrawer("replies");
        showToast("寄出啦，收到了暖心回应");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!store) {
    return <div className="h-screen w-screen bg-[#c5dbf5]" />;
  }

  const activeQ =
    store.questions.find((q) => q.id === store.activeQuestionId) || store.questions[0];
  const activeMsgs = store.dialogues[activeQ.id] || [];
  const activeQuestionBubble =
    store.whispers[0]?.bubbleQuestion || activeQ.bubblePrompt || activeQ.title;
  const coinDisplay = `${((store.pet.exp * 15 + 200) / 1000).toFixed(1)}k`;
  const levelBarPct = Math.min(100, Math.max(36, ((store.pet.exp % 120) / 120) * 100));

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-[#adc8ec] via-[#cde1f9] to-[#aac6eb] flex items-center justify-center select-none">
      {/* Subtle Screen Frame & 3D/2D Switcher on Desktop */}
      <div className="hidden sm:flex fixed top-4 right-4 z-50 items-center gap-2">
        <div className="flex items-center p-1 rounded-full bg-[#fdfbf7]/85 backdrop-blur-md shadow-xs">
          <button
            onClick={() => setRenderMode("3d")}
            className={`px-3 py-1 rounded-full text-[13px] font-bold transition cursor-pointer ${
              renderMode === "3d"
                ? "bg-[#63a4f7] text-white shadow-2xs"
                : "text-[#7a4b22] hover:bg-white/60"
            }`}
          >
            3D
          </button>
          <button
            onClick={() => setRenderMode("2d")}
            className={`px-3 py-1 rounded-full text-[13px] font-bold transition cursor-pointer ${
              renderMode === "2d"
                ? "bg-[#63a4f7] text-white shadow-2xs"
                : "text-[#7a4b22] hover:bg-white/60"
            }`}
          >
            2D
          </button>
        </div>

        <button
          onClick={() => setIsFullWindow(!isFullWindow)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#fdfbf7]/85 hover:bg-[#fdfbf7] backdrop-blur-md shadow-xs text-[13px] font-semibold text-[#7a4b22] cursor-pointer transition"
        >
          <span>{isFullWindow ? "手机竖屏" : "铺满窗口"}</span>
        </button>
      </div>

      {/* =============================================================== */}
      {/* MAIN STAGE (Instant resize via ResizeObserver — never clips!)   */}
      {/* =============================================================== */}
      <div
        className={`relative overflow-hidden bg-gradient-to-b from-[#bdd6f4] via-[#ddebfb] to-[#b5d2f3] ${
          isFullWindow
            ? "w-screen h-screen"
            : "w-full max-w-[430px] h-[100dvh] sm:h-[92vh] sm:max-h-[900px] sm:rounded-[46px] sm:border-[6px] sm:border-white/90 sm:shadow-[0_24px_80px_rgba(56,89,138,0.22)]"
        }`}
      >
        {/* Frosty Window Sunlight & Subtle Vector Snowflakes */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-24 left-10 w-[82%] h-[62%] opacity-65 blur-2xl"
            style={{
              background:
                "linear-gradient(155deg, rgba(255,255,255,0.92) 0%, rgba(235,246,255,0.45) 55%, rgba(219,234,254,0) 100%)",
              transform: "skewX(-16deg)",
            }}
          />
          <svg
            viewBox="0 0 32 32"
            className="absolute bottom-44 right-5 w-6 h-6 text-white/55"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="16" y1="4" x2="16" y2="28" />
            <line x1="5.6" y1="10" x2="26.4" y2="22" />
            <line x1="26.4" y1="10" x2="5.6" y2="22" />
          </svg>
        </div>

        {/* ============================================================= */}
        {/* STATUS BAR (Rounded Soft Numerals)                            */}
        {/* ============================================================= */}
        <div className="relative z-20 px-7 pt-3 pb-0.5 flex items-center justify-between text-[14px] font-semibold text-[#1e293b]">
          <div className="flex items-center gap-1.5">
            <span>00:32</span>
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-[#1e293b]">
              <path d="M8 2a4 4 0 0 0-4 4v2.5L2.7 10.2a.7.7 0 0 0 .5 1.2h9.6a.7.7 0 0 0 .5-1.2L12 8.5V6a4 4 0 0 0-4-4zm-1.5 10.5a1.5 1.5 0 0 0 3 0h-3z" />
              <line x1="2" y1="2" x2="14" y2="14" stroke="#1e293b" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="tracking-widest text-[11px]">•••</span>
            <span className="px-1.5 py-0.5 rounded-[6px] bg-[#1e293b] text-white text-[11px] font-semibold leading-none">
              56
            </span>
          </div>
        </div>

        {/* ============================================================= */}
        {/* TOP HEADER ROW                                                */}
        {/* ============================================================= */}
        <div className="relative z-20 px-4 pt-2 flex items-center justify-between gap-2.5 max-w-xl mx-auto">
          {/* Back Circle */}
          <button
            onClick={() => {
              if (drawer) setDrawer(null);
            }}
            className="w-11 h-11 rounded-full bg-[#fdfbf7]/95 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#c86d1f" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Center Profile Pill */}
          <button
            onClick={() => setDrawer("settings")}
            className="flex-1 h-13 rounded-full bg-[#fdfbf7]/95 shadow-[0_3px_12px_rgba(120,150,190,0.16)] px-2.5 flex items-center justify-between gap-2 active:scale-[0.99] transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-[#e6f2fe] border-2 border-white overflow-hidden flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${BASE_PATH}/kanshan-anim/wave.gif`} alt="看山" className="w-10 h-10 object-cover" />
              </div>
              <div className="text-left leading-snug">
                <div className="text-[15px] font-bold text-[#784315]">
                  {store.persona.nickname}
                </div>
                <div className="text-[12px] font-medium text-[#9e6534]">
                  {store.persona.roleTag}
                </div>
              </div>
            </div>

            {/* Concentric Mood Rings */}
            <svg viewBox="0 0 36 36" className="w-9 h-9 shrink-0">
              <circle cx="18" cy="18" r="14.5" fill="none" stroke="#e0f2fe" strokeWidth="3.2" />
              <circle cx="18" cy="18" r="14.5" fill="none" stroke="#4cc3f7" strokeWidth="3.2" strokeDasharray="74 100" strokeLinecap="round" />
              <circle cx="18" cy="18" r="10" fill="none" stroke="#fef3c7" strokeWidth="3.2" />
              <circle cx="18" cy="18" r="10" fill="none" stroke="#fbbf24" strokeWidth="3.2" strokeDasharray="50 100" strokeLinecap="round" />
              <circle cx="18" cy="18" r="5.5" fill="none" stroke="#ffedd5" strokeWidth="3.2" />
              <circle cx="18" cy="18" r="5.5" fill="none" stroke="#fb923c" strokeWidth="3.2" strokeDasharray="28 100" strokeLinecap="round" />
            </svg>
          </button>

          {/* Wardrobe Tee Button */}
          <button
            onClick={() => setDrawer("wardrobe")}
            className="w-11 h-11 rounded-full bg-[#8fa8cb]/80 backdrop-blur-md shadow-[0_3px_10px_rgba(120,150,190,0.2)] flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0"
          >
            <svg viewBox="0 0 28 28" className="w-6 h-6">
              <path
                d="M9 6 L19 6 L24 9.5 L21.2 13.5 L19 12 L19 22.5 L9 22.5 L9 12 L6.8 13.5 L4 9.5 Z"
                fill="#fde047"
                stroke="#eab308"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* ============================================================= */}
        {/* SUB-HEADER ROW (Share | Plump Star + Paw + Coin | Clean Balance) */}
        {/* ============================================================= */}
        <div className="relative z-20 px-4 pt-2.5 flex items-center justify-between gap-2 max-w-xl mx-auto">
          {/* Share / Letter Button */}
          <button
            onClick={openSnowmanLetter}
            className="w-11 h-11 rounded-full bg-[#fdfbf7]/95 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#c86d1f]">
              <path d="M14 5v4C7 9 4 14 3 19c2.5-3.5 6-5.1 11-5.1V18l7-6.5L14 5z" />
            </svg>
          </button>

          {/* 3 Custom Vector Status Pills */}
          <div className="flex items-center gap-2">
            {/* Star Level */}
            <div className="h-7 pr-2.5 pl-0.5 rounded-full bg-[#92aacb]/65 backdrop-blur-md flex items-center gap-1.5">
              <div className="relative w-7 h-7 -ml-1 flex items-center justify-center">
                <svg viewBox="0 0 32 32" className="w-7 h-7 drop-shadow-2xs">
                  <path
                    d="M16 2.5l3.9 7.9 8.7 1.3-6.3 6.1 1.5 8.7L16 22.4l-7.8 4.1 1.5-8.7-6.3-6.1 8.7-1.3z"
                    fill="#facc15"
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="absolute text-[11px] font-bold text-[#784315] mt-0.5">
                  {store.pet.level}
                </span>
              </div>
              <div className="w-8 h-2.5 rounded-full bg-slate-700/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-300 to-orange-400 rounded-full"
                  style={{ width: `${levelBarPct}%` }}
                />
              </div>
            </div>

            {/* Pink Paw Prints */}
            <button
              onClick={() =>
                store.publishedAnswers.length > 0 ? setDrawer("replies") : openSnowmanLetter()
              }
              className="h-7 pr-3 pl-1 rounded-full bg-[#92aacb]/65 backdrop-blur-md flex items-center gap-1.5 cursor-pointer"
            >
              <span className="w-5.5 h-5.5 rounded-full bg-[#fdfbf7] flex items-center justify-center shadow-2xs">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#f472b6]">
                  <ellipse cx="12" cy="15.5" rx="4.5" ry="3.6" />
                  <circle cx="6.8" cy="10.5" r="1.8" />
                  <circle cx="10.2" cy="8.2" r="1.8" />
                  <circle cx="13.8" cy="8.2" r="1.8" />
                  <circle cx="17.2" cy="10.5" r="1.8" />
                </svg>
              </span>
              <span className="text-[13px] font-bold text-white">
                {store.persona.zhihuStats.publishedCount}
              </span>
            </button>

            {/* Gold Paw Coin */}
            <div className="h-7 pr-3 pl-1 rounded-full bg-[#92aacb]/65 backdrop-blur-md flex items-center gap-1.5">
              <span className="w-5.5 h-5.5 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 border border-amber-200 flex items-center justify-center shadow-2xs">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-[#fffbeb]">
                  <ellipse cx="12" cy="15" rx="4" ry="3.2" />
                  <circle cx="7.5" cy="10.2" r="1.5" />
                  <circle cx="12" cy="8.4" r="1.6" />
                  <circle cx="16.5" cy="10.2" r="1.5" />
                </svg>
              </span>
              <span className="text-[13px] font-bold text-white">{coinDisplay}</span>
            </div>
          </div>

          {/* Invisible spacer keeps the 3 status pills symmetrically centered */}
          <div className="w-11 h-11 shrink-0 pointer-events-none" aria-hidden="true" />
        </div>

        {/* ============================================================= */}
        {/* LEFT VERTICAL WARM VECTOR BUTTONS (Flower / Bell / Notebook)  */}
        {/* ============================================================= */}
        <div className="absolute left-4 top-[178px] z-20 flex flex-col gap-3.5">
          {/* Flower Gear */}
          <button
            onClick={() => setDrawer("settings")}
            className="w-11 h-11 rounded-full bg-[#fdfbf7]/94 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex items-center justify-center active:scale-95 transition cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#c86d1f]">
              <path d="M12 2a2.4 2.4 0 0 1 2.2 1.5 2.4 2.4 0 0 1 2.7-.5 2.4 2.4 0 0 1 1.1 2.5 2.4 2.4 0 0 1 2.1 1.6 2.4 2.4 0 0 1-.6 2.7 2.4 2.4 0 0 1 .6 2.7 2.4 2.4 0 0 1-2.1 1.6 2.4 2.4 0 0 1-1.1 2.5 2.4 2.4 0 0 1-2.7-.5A2.4 2.4 0 0 1 12 22a2.4 2.4 0 0 1-2.2-1.5 2.4 2.4 0 0 1-2.7.5 2.4 2.4 0 0 1-1.1-2.5 2.4 2.4 0 0 1-2.1-1.6 2.4 2.4 0 0 1 .6-2.7 2.4 2.4 0 0 1-.6-2.7A2.4 2.4 0 0 1 6 5.1a2.4 2.4 0 0 1 1.1-2.5 2.4 2.4 0 0 1 2.7.5A2.4 2.4 0 0 1 12 2zm0 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
            </svg>
          </button>

          {/* Soft Bell */}
          <button
            onClick={() => setDrawer("bubble")}
            className="relative w-11 h-11 rounded-full bg-[#fdfbf7]/94 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex items-center justify-center active:scale-95 transition cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#c86d1f]">
              <path d="M12 3a5 5 0 0 0-5 5v3.2L5.3 13.8a1 1 0 0 0 .8 1.6h11.8a1 1 0 0 0 .8-1.6L17 11.2V8a5 5 0 0 0-5-5zm-2 14a2 2 0 0 0 4 0h-4z" />
            </svg>
            <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-[#f97316] border-2 border-[#fdfbf7]" />
          </button>

          {/* Spiral Notebook */}
          <button
            onClick={() => setDrawer("diary")}
            className="w-11 h-11 rounded-full bg-[#fdfbf7]/94 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex items-center justify-center active:scale-95 transition cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <rect x="6" y="4" width="13" height="16" rx="3" fill="#c86d1f" />
              <line x1="4.5" y1="8" x2="7.5" y2="8" stroke="#fdfbf7" strokeWidth="2" strokeLinecap="round" />
              <line x1="4.5" y1="12" x2="7.5" y2="12" stroke="#fdfbf7" strokeWidth="2" strokeLinecap="round" />
              <line x1="4.5" y1="16" x2="7.5" y2="16" stroke="#fdfbf7" strokeWidth="2" strokeLinecap="round" />
              <path d="M11 14.5l4-4 1.5 1.5-4 4H11v-1.5z" fill="#fdfbf7" />
            </svg>
          </button>

          {/* In-Frame 3D / 2D Quick Switch Badge (works on mobile & portrait too!) */}
          <button
            onClick={() => {
              const next = renderMode === "3d" ? "2d" : "3d";
              setRenderMode(next);
              showToast(next === "2d" ? "已切换为绘本 2D 看山" : "已切换为立体 3D 看山");
            }}
            className="w-11 h-11 rounded-full bg-[#fdfbf7]/94 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex flex-col items-center justify-center active:scale-95 transition cursor-pointer"
            title="切换 3D / 2D 画风"
          >
            <span className="text-[13px] font-bold text-[#c86d1f] leading-none">
              {renderMode === "3d" ? "2D" : "3D"}
            </span>
            <span className="text-[9px] font-semibold text-[#9e6534] mt-0.5 leading-none">
              画风
            </span>
          </button>
        </div>

        {/* ============================================================= */}
        {/* EXPERIENCE-LINKED TOPIC QUESTION BUBBLE ("提问题的那个提问")   */}
        {/* ============================================================= */}
        {toast ? (
          <div className="absolute top-[166px] left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-[#52657c]/85 backdrop-blur-md text-white text-[13px] font-medium shadow-sm whitespace-nowrap">
            {toast}
          </div>
        ) : (
          <button
            onClick={() => setDrawer("bubble")}
            className={`absolute top-[200px] left-1/2 -translate-x-1/2 z-10 w-max ${
              isFullWindow ? "max-w-[260px] sm:max-w-[380px]" : "max-w-[248px]"
            } px-3.5 py-2 rounded-[22px] bg-[#fdfbf7]/94 hover:bg-[#fdfbf7] backdrop-blur-md shadow-[0_4px_16px_rgba(116,150,196,0.2)] flex items-start gap-2 text-left transition cursor-pointer`}
          >
            <span className="mt-0.5 w-4.5 h-4.5 rounded-full bg-[#63a4f7] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              ?
            </span>
            <span className="text-[13px] font-bold text-[#6e4720] leading-snug">
              {isHuntingTreasure ? "去雪原上替你翻新宝贝咯…" : activeQuestionBubble}
            </span>
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#fdfbf7]/92 rotate-45" />
          </button>
        )}

        {/* ============================================================= */}
        {/* FULL-BLEED 3D OR 2D STAGE (Autonomous Snowman + Room Items!)  */}
        {/* ============================================================= */}
        <div className="absolute inset-0 z-0">
          {renderMode === "3d" ? (
            <KanShanStage3D
              pet={store.pet}
              hoardedItems={store.hoardedItems}
              isHuntingTreasure={isHuntingTreasure}
              isRecordingNose={isRecordingNose}
              onTapHead={() => {
                showToast("蹭了蹭你的手心");
                postState({ action: "hardware_interact", interactType: "head_pat" });
              }}
              onTapNoseStart={handleNoseStart}
              onTapNoseEnd={handleNoseEnd}
              onTapSnowman={openSnowmanLetter}
              onSelectHoardItem={handleSelectHoardInRoom}
            />
          ) : (
            <KanShanStage2D
              pet={store.pet}
              hoardedItems={store.hoardedItems}
              isHuntingTreasure={isHuntingTreasure}
              isRecordingNose={isRecordingNose}
              onTapHead={() => {
                showToast("蹭了蹭你的手心");
                postState({ action: "hardware_interact", interactType: "head_pat" });
              }}
              onTapNoseStart={handleNoseStart}
              onTapNoseEnd={handleNoseEnd}
              onTapSnowman={openSnowmanLetter}
              onSelectHoardItem={handleSelectHoardInRoom}
            />
          )}
        </div>

        {/* ============================================================= */}
        {/* RIGHT TRANSLUCENT PILL (Feed + Whisper Only — Clean & Compact)*/}
        {/* ============================================================= */}
        <div className="absolute right-4 top-[250px] z-20 w-[62px] py-3.5 rounded-full bg-white/58 backdrop-blur-md border border-white/70 shadow-[0_6px_24px_rgba(125,158,200,0.18)] flex flex-col items-center gap-4">
          {/* 喂食: Plump Orange Pet Bowl with White Paw */}
          <button
            onClick={handleFeedCodfish}
            className="flex flex-col items-center gap-1 active:scale-95 transition cursor-pointer"
          >
            <svg viewBox="0 0 40 40" className="w-10 h-10">
              <ellipse cx="20" cy="14" rx="11" ry="4.5" fill="#fdba74" />
              <path d="M8 15 L11 29 C11.5 31.5 28.5 31.5 29 29 L32 15 Z" fill="#f97316" />
              <ellipse cx="20" cy="14.5" rx="8.5" ry="3" fill="#9a3412" />
              <circle cx="20" cy="23.5" r="2.3" fill="#fff7ed" />
              <circle cx="16.8" cy="20.5" r="1.1" fill="#fff7ed" />
              <circle cx="20" cy="19.5" r="1.1" fill="#fff7ed" />
              <circle cx="23.2" cy="20.5" r="1.1" fill="#fff7ed" />
            </svg>
            <span className="text-[13px] font-bold text-[#784315]">喂食</span>
          </button>

          {/* 树洞: Pink + Blue Twin Blobs */}
          <button
            onClick={() => setDrawer("whisper")}
            className="flex flex-col items-center gap-1 active:scale-95 transition cursor-pointer"
          >
            <svg viewBox="0 0 40 40" className="w-10 h-10">
              <circle cx="24" cy="17" r="9.5" fill="#60a5fa" />
              <circle cx="22" cy="16" r="1.1" fill="#1e3a8a" />
              <circle cx="26" cy="16" r="1.1" fill="#1e3a8a" />
              <circle cx="16" cy="23" r="9.5" fill="#f472b6" />
              <circle cx="14" cy="22.5" r="1.1" fill="#831843" />
              <circle cx="18" cy="22.5" r="1.1" fill="#831843" />
              <circle cx="12.5" cy="11" r="2" fill="#f472b6" />
            </svg>
            <span className="text-[13px] font-bold text-[#784315]">树洞</span>
          </button>
        </div>

        {/* ============================================================= */}
        {/* BOTTOM CURVED SNOW DOME (`出门` Refreshes Room Treasures!)    */}
        {/* ============================================================= */}
        <div
          onClick={handleGoOutdoors}
          className="absolute -bottom-8 left-[-10%] right-[-10%] h-38 z-20 rounded-t-[100%] bg-gradient-to-b from-white/55 via-white/78 to-white/94 backdrop-blur-md border-t border-white/85 flex flex-col items-center pt-3 cursor-pointer hover:from-white/70 active:scale-[0.99] transition"
        >
          <div className="w-8 h-1 rounded-full bg-white mb-2.5" />
          <div className="relative">
            <svg
              viewBox="0 0 48 48"
              className={`w-12 h-12 drop-shadow-2xs transition-transform duration-500 ${
                isHuntingTreasure ? "rotate-180 scale-110" : ""
              }`}
            >
              <circle cx="24" cy="24" r="19" fill="#93d5ff" />
              <path
                d="M14 14 C18 13, 22 16, 21 21 C20 25, 14 26, 12 31 C9 27, 9 19, 14 14 Z"
                fill="#6ee7b7"
              />
              <path
                d="M28 11 C34 12, 39 18, 38 25 C36 30, 31 28, 29 34 C26 32, 26 24, 29 20 C31 17, 26 14, 28 11 Z"
                fill="#6ee7b7"
              />
            </svg>
            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[#facc15] border-2 border-white shadow-2xs" />
          </div>
          <span className="text-[14px] font-bold text-[#784315] mt-0.5">
            {isHuntingTreasure ? "寻宝中…" : "出门"}
          </span>
        </div>

        {/* ============================================================= */}
        {/* COZY BOTTOM SHEETS (Soft Cream & Ice-Milk Surfaces)           */}
        {/* ============================================================= */}
        {drawer && (
          <div
            className="absolute inset-0 z-40 bg-[#334e68]/18 backdrop-blur-[2px] flex items-end justify-center"
            onClick={() => setDrawer(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-[36px] bg-[#f9fbff]/96 backdrop-blur-xl border-t border-white shadow-[0_-12px_40px_rgba(65,98,145,0.18)] p-5 pb-7 max-h-[66%] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      drawer === "whisper"
                        ? `${BASE_PATH}/kanshan-anim/sleepy.gif`
                        : drawer === "snowman" || drawer === "bubble"
                        ? `${BASE_PATH}/kanshan-anim/laptop.gif`
                        : `${BASE_PATH}/kanshan-anim/idle.gif`
                    }
                    alt=""
                    className="w-9 h-9 object-contain"
                  />
                  <span className="text-[16px] font-bold text-[#6e4720]">
                    {drawer === "wardrobe" && "小衣柜"}
                    {drawer === "whisper" && "跟看山念叨两句"}
                    {drawer === "bubble" && "外面的同频夜话"}
                    {drawer === "diary" && "悄悄话本子"}
                    {drawer === "snowman" && "雪球里的信"}
                    {drawer === "treasure" && (selectedHoard?.itemName || "屋里发光的小物件")}
                    {drawer === "replies" && "雪球收到的回音"}
                    {drawer === "settings" && "性格波长"}
                  </span>
                </div>
                <button
                  onClick={() => setDrawer(null)}
                  className="w-8 h-8 rounded-full bg-[#e8f0fa] flex items-center justify-center text-[#6e829a] cursor-pointer"
                >
                  <svg viewBox="0 0 20 20" className="w-4 h-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="5" y1="5" x2="15" y2="15" />
                    <line x1="15" y1="5" x2="5" y2="15" />
                  </svg>
                </button>
              </div>

              {/* WARDROBE */}
              {drawer === "wardrobe" && (
                <div className="grid grid-cols-3 gap-2.5">
                  {accessories.map((item) => {
                    const equipped = store.pet.equippedItems.includes(item.id);
                    const unlocked = store.pet.unlockedItems.includes(item.id);
                    const canAfford = store.pet.exp >= item.costExp;
                    return (
                      <button
                        key={item.id}
                        disabled={!unlocked && !canAfford}
                        onClick={() => postState({ action: "toggle_accessory", itemId: item.id })}
                        className={`p-3.5 rounded-[22px] text-center flex flex-col items-center gap-1.5 transition cursor-pointer ${
                          equipped
                            ? "bg-[#e1effe] ring-2 ring-[#7cb4f8]"
                            : unlocked || canAfford
                            ? "bg-white/90 shadow-[0_2px_10px_rgba(148,179,214,0.14)] hover:bg-white"
                            : "bg-slate-100/70 opacity-50"
                        }`}
                      >
                        <ItemVectorIcon id={item.id} />
                        <span className="text-[13px] font-bold text-[#5a4636] line-clamp-1">
                          {item.name}
                        </span>
                        <span className="text-[11px] font-medium text-[#8b9bb0]">
                          {equipped ? "穿戴中" : unlocked ? "换上" : `${item.costExp} 经验`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* WHISPER */}
              {drawer === "whisper" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#708399]">
                      不想发朋友圈的话，留在这里就好
                    </span>
                    <button
                      onMouseDown={handleNoseStart}
                      onMouseUp={handleNoseEnd}
                      className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold cursor-pointer transition ${
                        isRecordingNose
                          ? "bg-[#5b9bf8] text-white"
                          : "bg-[#e6f1fe] text-[#4a7ec7]"
                      }`}
                    >
                      {isRecordingNose ? "松开说完" : "按住说话"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {VOICE_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => setWhisperInput(p.full)}
                        className="text-[12px] px-3 py-1.5 rounded-full bg-white shadow-[0_2px_8px_rgba(148,179,214,0.14)] text-[#6e5a49] hover:bg-[#fef9f2] cursor-pointer"
                      >
                        {p.short}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    value={whisperInput}
                    onChange={(e) => setWhisperInput(e.target.value)}
                    placeholder="今天过得怎么样…"
                    className="w-full rounded-[22px] bg-white shadow-[inset_0_2px_6px_rgba(148,179,214,0.14)] p-3.5 text-[14px] text-[#4c3b2e] placeholder:text-[#a8b6c7] focus:outline-none resize-none"
                  />
                  <button
                    disabled={!whisperInput.trim() || busy}
                    onClick={submitWhisper}
                    className="w-full py-3 rounded-full bg-gradient-to-r from-[#69acf8] to-[#5294ef] disabled:opacity-40 text-white text-[14px] font-bold shadow-xs cursor-pointer"
                  >
                    团进雪球里
                  </button>
                </div>
              )}

              {/* BUBBLE CHAT */}
              {drawer === "bubble" && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-[22px] bg-[#edf5ff]">
                    <div className="text-[12px] font-semibold text-[#5b8fd9]">{activeQ.topic}</div>
                    <div className="text-[14px] font-bold text-[#4c3b2e] mt-0.5 leading-snug">
                      {activeQ.title}
                    </div>
                  </div>
                  <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                    {activeMsgs.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[84%] px-3.5 py-2.5 rounded-[20px] text-[13px] leading-relaxed ${
                            m.role === "user"
                              ? "bg-[#63a4f7] text-white"
                              : "bg-white shadow-[0_2px_8px_rgba(148,179,214,0.12)] text-[#57493d]"
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendChat()}
                      placeholder="回看山一句…"
                      className="flex-1 text-[13px] rounded-full bg-white shadow-[inset_0_2px_6px_rgba(148,179,214,0.14)] px-4 py-2.5 text-[#4c3b2e] placeholder:text-[#a8b6c7] focus:outline-none"
                    />
                    <button
                      disabled={!chatInput.trim() || busy}
                      onClick={() => sendChat()}
                      className="px-4 py-2.5 rounded-full bg-[#63a4f7] text-white text-[13px] font-bold cursor-pointer"
                    >
                      发送
                    </button>
                    <button
                      onClick={openSnowmanLetter}
                      className="px-3.5 py-2.5 rounded-full bg-[#fde047] text-[#784315] text-[13px] font-bold whitespace-nowrap cursor-pointer"
                    >
                      看雪球信
                    </button>
                  </div>
                </div>
              )}

              {/* SNOWMAN LETTER */}
              {drawer === "snowman" && draftInfo && (
                <div className="space-y-3">
                  <div className="px-3.5 py-2.5 rounded-[20px] bg-[#edf5ff] flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-[#5476a3]">
                      自动隐去学校和名字（{draftInfo.redactedTerms.join(" · ")}）
                    </span>
                    <input
                      type="checkbox"
                      checked={hideNames}
                      onChange={(e) => {
                        setHideNames(e.target.checked);
                        setPostText(
                          e.target.checked ? draftInfo.desensitizedDraft : draftInfo.rawDraft
                        );
                      }}
                      className="accent-[#5b9bf8] w-4 h-4 shrink-0"
                    />
                  </div>
                  <textarea
                    rows={6}
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    className="w-full rounded-[22px] bg-white shadow-[inset_0_2px_6px_rgba(148,179,214,0.14)] p-3.5 text-[13px] leading-relaxed text-[#4c3b2e] focus:outline-none"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(postText);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1800);
                        }}
                        className="px-3.5 py-2 rounded-full bg-white shadow-2xs text-[13px] font-semibold text-[#6e5a49] cursor-pointer"
                      >
                        {copied ? "已复制" : "复制文字"}
                      </button>
                      <a
                        href={draftInfo.question.zhihuSearchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-full bg-white shadow-2xs text-[13px] font-semibold text-[#528be0]"
                      >
                        去原问题看
                      </a>
                    </div>
                    <button
                      disabled={busy}
                      onClick={publishSnowman}
                      className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#784315] text-[13px] font-bold shadow-2xs cursor-pointer"
                    >
                      寄出去
                    </button>
                  </div>
                </div>
              )}

              {/* DIARY */}
              {drawer === "diary" && (
                <div className="space-y-2.5">
                  {store.whispers.map((w) => (
                    <div
                      key={w.id}
                      className="p-4 rounded-[22px] bg-white shadow-[0_2px_10px_rgba(148,179,214,0.12)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[12px] text-[#94a3b8]">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#edf5ff] text-[#528be0] font-semibold">
                          {w.emotionTag}
                        </span>
                        <span>{w.createdAt}</span>
                      </div>
                      <p className="text-[13px] text-[#4c3b2e] leading-relaxed">{w.rawText}</p>
                      <p className="text-[12px] text-[#8496ab]">{w.structuredSummary}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* DIRECT ROOM TREASURE CARD (Clicked directly from glowing 3D/2D room item!) */}
              {drawer === "treasure" && selectedHoard && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-[22px] bg-gradient-to-r from-[#fff9db] via-[#fef5c8] to-[#edf6ff] border border-[#fde68a]/80 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/95 shadow-2xs flex items-center justify-center shrink-0">
                      <ItemVectorIcon id={selectedHoard.emoji || selectedHoard.id} />
                    </div>
                    <div className="leading-snug">
                      <div className="text-[12px] font-bold text-[#b46914]">
                        看山从外面衔回屋里的小物件
                      </div>
                      <div className="text-[13px] text-[#5c4a3a] mt-0.5">
                        {selectedHoard.reason}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-[22px] bg-white shadow-[0_2px_12px_rgba(148,179,214,0.14)] space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[12px] text-[#7c8da3]">
                      <span className="font-semibold text-[#528be0]">{selectedHoard.author}</span>
                      <span>知乎高赞回答</span>
                    </div>
                    <div className="text-[15px] font-bold text-[#4c3b2e] leading-snug">
                      {selectedHoard.postTitle}
                    </div>
                    <p className="text-[13px] text-[#64758b] leading-relaxed">
                      {selectedHoard.excerpt}
                    </p>
                    <div className="pt-1 flex items-center justify-between">
                      <a
                        href={selectedHoard.zhihuUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 rounded-full bg-[#e8f2ff] hover:bg-[#dbeafe] text-[13px] font-bold text-[#3b7dd8] transition"
                      >
                        翻开原帖看看 ›
                      </a>
                      <button
                        onClick={() => {
                          setDrawer(null);
                          handleGoOutdoors();
                        }}
                        className="text-[12px] font-semibold text-[#9a6b3b] hover:text-[#784315] cursor-pointer"
                      >
                        让看山再出门换一批
                      </button>
                    </div>
                  </div>

                  {/* Quick pills for the other two glowing treasures currently in the room */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {store.hoardedItems.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => setSelectedHoard(h)}
                        className={`flex-1 py-2 px-2.5 rounded-full text-[12px] font-bold truncate transition cursor-pointer ${
                          selectedHoard.id === h.id
                            ? "bg-[#63a4f7] text-white shadow-2xs"
                            : "bg-white/90 text-[#6e5a49] shadow-2xs"
                        }`}
                      >
                        {h.itemName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* REPLIES TO PUBLISHED SNOWBALL */}
              {drawer === "replies" && (
                <div className="space-y-3">
                  {store.publishedAnswers.length > 0 ? (
                    store.publishedAnswers.map((ans) => (
                      <div
                        key={ans.id}
                        className="p-4 rounded-[22px] bg-[#fff9ed] border border-[#fde68a]/70 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-bold text-[#9a5b25]">
                            寄出的雪球收到了 {ans.upvotes} 份赞同
                          </span>
                          <span className="text-[11px] text-[#a38b73]">{ans.createdAt}</span>
                        </div>
                        <p className="text-[12px] text-[#6e5a49] line-clamp-2">{ans.content}</p>
                        <div className="space-y-2 pt-1">
                          {ans.warmComments.map((c, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-[16px] bg-white/95 text-[13px] text-[#5c4a3a] shadow-2xs"
                            >
                              <span className="font-bold text-[#784315]">{c.author}：</span>「
                              {c.text}」
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-[22px] bg-white text-[13px] text-[#6e7f94]">
                      还没有寄出过雪球信，点看山身边的雪球就能写一封啦。
                    </div>
                  )}
                </div>
              )}

              {/* SETTINGS */}
              {drawer === "settings" && (
                <div className="space-y-3">
                  <div className="p-4 rounded-[22px] bg-white shadow-[0_2px_10px_rgba(148,179,214,0.12)]">
                    <div className="text-[14px] font-bold text-[#5a4636]">
                      {store.persona.mirrorTrait}
                    </div>
                    <p className="text-[13px] text-[#7c8da3] mt-1">{store.persona.speakingStyle}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {["INFP", "INTJ", "ENFP", "ISTJ"].map((code) => (
                      <button
                        key={code}
                        onClick={() => postState({ action: "update_persona", mbti: code })}
                        className={`py-2.5 rounded-full text-[13px] font-bold cursor-pointer transition ${
                          store.persona.mbti === code
                            ? "bg-[#63a4f7] text-white"
                            : "bg-white text-[#6e5a49] shadow-2xs"
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      postState({ action: "reset_storyline" });
                      setDrawer(null);
                      showToast("已回到最初");
                    }}
                    className="w-full py-3 rounded-full bg-[#edf3fa] hover:bg-[#e1ecf8] text-[13px] font-bold text-[#647890] cursor-pointer"
                  >
                    回到最初
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
