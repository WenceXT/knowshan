"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AccessoryItem,
  HoardedItem,
  KnowShanStore,
  SnowballCreationMode,
} from "@/types/knowshan";
import KanShanStage2D from "@/components/KanShanStage2D";
import SnowballCreationSheet from "@/components/SnowballCreationSheet";
import BurrowChatModal from "@/components/BurrowChatModal";
import {
  apiAddDollVoiceRecord,
  apiConfirmSnowballPublished,
  apiGetState,
  apiPostState,
  apiSelectChatSession,
} from "@/lib/client-api";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const KanShanStage3D = dynamic(() => import("@/components/KanShanStage3D"), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

type DrawerType =
  | null
  | "wardrobe"
  | "burrow"
  | "snowman"
  | "nose_voice"
  | "treasure"
  | "replies"
  | "settings";

const MBTI_MENU_GROUPS = [
  {
    group: "外交家 · NF",
    items: [
      { code: "INFP", title: "调停者", desc: "慢热细腻、共情护短" },
      { code: "INFJ", title: "提倡者", desc: "安静通透、懂你潜台词" },
      { code: "ENFP", title: "竞选者", desc: "脑洞元气、快乐小狗魂" },
      { code: "ENFJ", title: "主人公", desc: "温暖撑腰、善解人意" },
    ],
  },
  {
    group: "分析家 · NT",
    items: [
      { code: "INTJ", title: "建筑师", desc: "外冷内热、清醒理智" },
      { code: "INTP", title: "逻辑学家", desc: "深夜奇思、猫系松弛" },
      { code: "ENTJ", title: "指挥官", desc: "嘴硬心软、果断兜底" },
      { code: "ENTP", title: "辩论家", desc: "幽默拆台、专治内耗" },
    ],
  },
  {
    group: "守护者 · SJ",
    items: [
      { code: "ISTJ", title: "物流师", desc: "事事回音、稳重靠谱" },
      { code: "ISFJ", title: "守卫者", desc: "温柔妥帖、细节控" },
      { code: "ESTJ", title: "总经理", desc: "行动干脆、拆解烦恼" },
      { code: "ESFJ", title: "执政官", desc: "热情护犊、随时哄你" },
    ],
  },
  {
    group: "探险家 · SP",
    items: [
      { code: "ISFP", title: "探险家", desc: "浪漫随性、收集美好" },
      { code: "ISTP", title: "鉴赏家", desc: "淡定松弛、从不慌张" },
      { code: "ESTP", title: "企业家", desc: "潇洒直接、先干再说" },
      { code: "ESFP", title: "表演者", desc: "开心果、把日子变烟花" },
    ],
  },
];

const NOSE_VOICE_PRESETS = [
  "今天下午在新闻学院张老师的传播学专业课做小组 Pre 忘词了，手心一直在出汗……",
  "刚收到两个实习面试通知，纠结选喜欢的方向还是补贴更高的岗位。",
  "一个人熬到十二点半还没睡，想对着看山叹口气再关灯。",
];

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
        </svg>
      );
    case "acorn":
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <ellipse cx="18" cy="13.5" rx="10" ry="4.8" fill="#92400e" />
          <path d="M10 15 C10 26 18 30 18 30 C18 30 26 26 26 15 Z" fill="#f59e0b" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 36 36" className="w-8 h-8">
          <circle cx="18" cy="18" r="10" fill="#fde047" />
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

  const [selectedHoard, setSelectedHoard] = useState<HoardedItem | null>(null);
  const [mbtiMenuOpen, setMbtiMenuOpen] = useState(true);

  // Module A: Snowball Random 3-Mode Creation State
  const [snowballMode, setSnowballMode] = useState<SnowballCreationMode>("answer");
  const [preferredSnowSessionId, setPreferredSnowSessionId] = useState<string | undefined>(
    undefined
  );

  // Doll Nose Voice Capture State
  const [noseTranscript, setNoseTranscript] = useState("");
  const [noseDurationSec, setNoseDurationSec] = useState(5);
  const [noseAudioUrl, setNoseAudioUrl] = useState<string | undefined>(undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const noseStartMsRef = useRef<number>(0);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2600);
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
          if (t) setNoseTranscript(t);
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

  // =====================================================================
  // 3D / 2D DOLL NOSE RECORDING -> SYNCS INTO BURROW "来自玩偶的声音"
  // =====================================================================
  const handleNoseStart = async () => {
    setIsRecordingNose(true);
    setNoseTranscript("");
    setNoseAudioUrl(undefined);
    noseStartMsRef.current = Date.now();
    showToast("正在对刘看山玩偶说悄悄话…");

    try {
      recRef.current?.start();
    } catch {
      // ignore
    }

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (ev) => {
          if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };
        mr.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            setNoseAudioUrl(URL.createObjectURL(blob));
          }
        };
        mr.start();
        mediaRecRef.current = mr;
      } catch {
        // ignore
      }
    }
  };

  const handleNoseEnd = () => {
    if (!isRecordingNose) return;
    setIsRecordingNose(false);
    const dur = Math.max(2, Math.round((Date.now() - noseStartMsRef.current) / 1000));
    setNoseDurationSec(dur);

    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    try {
      mediaRecRef.current?.stop();
    } catch {
      // ignore
    }
    setDrawer("nose_voice");
  };

  const handleSaveNoseVoice = async () => {
    const text = noseTranscript.trim();
    if (!text) return;
    const res = await apiAddDollVoiceRecord({
      transcript: text,
      durationSec: noseDurationSec,
      audioUrl: noseAudioUrl,
    });
    setStore(res.store);
    setNoseTranscript("");
    setDrawer(null);
    showToast("玩偶语音已同步进树洞「来自玩偶的声音」！");
  };

  // =====================================================================
  // SNOWBALL CLICK -> RANDOM 1/3 SELECTION OF (ASK / ANSWER / POST)
  // =====================================================================
  const openRandomSnowmanCreation = (fromSessionId?: string) => {
    const modes: SnowballCreationMode[] = ["ask", "answer", "post"];
    const randomMode = modes[Math.floor(Math.random() * modes.length)];
    setSnowballMode(randomMode);
    setPreferredSnowSessionId(fromSessionId);
    setDrawer("snowman");
  };

  const handleConfirmSnowballPublished = async (payload: {
    creationType: SnowballCreationMode;
    questionId: string;
    title: string;
    content: string;
    desensitized: boolean;
    redactedTerms: string[];
  }) => {
    const res = await apiConfirmSnowballPublished(payload);
    setStore(res.store);
    setDrawer("replies");
    // Joyful celebration hop + codfish reward!
    setIsHuntingTreasure(true);
    showToast("庆祝成功！雪球化作一条小银鳕鱼，经验 +120！");
    setTimeout(() => setIsHuntingTreasure(false), 1200);
  };

  const handleFeedCodfish = async () => {
    await postState({ action: "hardware_interact", interactType: "feed_codfish" });
    showToast("喂了一小块银鳕鱼，看山开心地摇了摇尾巴");
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
      showToast("叼回三件散发微光的新小物件，点屋里看看吧");
    }, 850);
  };

  if (!store) {
    return <div className="h-screen w-screen bg-[#c5dbf5]" />;
  }

  const activeQ =
    store.questions.find((q) => q.id === store.activeQuestionId) || store.questions[0];
  const activeQuestionBubble =
    store.whispers[0]?.bubbleQuestion || activeQ.bubblePrompt || activeQ.title;
  const coinDisplay = `${((store.pet.exp * 15 + 200) / 1000).toFixed(1)}k`;
  const levelBarPct = Math.min(100, Math.max(36, ((store.pet.exp % 120) / 120) * 100));

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-[#adc8ec] via-[#cde1f9] to-[#aac6eb] flex items-center justify-center select-none">
      {/* Screen Frame & 3D/2D Switcher on Desktop */}
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
      {/* MAIN STAGE                                                      */}
      {/* =============================================================== */}
      <div
        className={`relative overflow-hidden bg-gradient-to-b from-[#bdd6f4] via-[#ddebfb] to-[#b5d2f3] ${
          isFullWindow
            ? "w-screen h-screen"
            : "w-full max-w-[430px] h-[100dvh] sm:h-[92vh] sm:max-h-[900px] sm:rounded-[46px] sm:border-[6px] sm:border-white/90 sm:shadow-[0_24px_80px_rgba(56,89,138,0.22)]"
        }`}
      >
        {/* Frosty Window Sunlight */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-24 left-10 w-[82%] h-[62%] opacity-65 blur-2xl"
            style={{
              background:
                "linear-gradient(155deg, rgba(255,255,255,0.92) 0%, rgba(235,246,255,0.45) 55%, rgba(219,234,254,0) 100%)",
              transform: "skewX(-16deg)",
            }}
          />
        </div>

        {/* STATUS BAR */}
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

        {/* TOP HEADER ROW */}
        <div className="relative z-20 px-4 pt-2 flex items-center justify-between gap-2.5 max-w-xl mx-auto">
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

          {/* Center Profile Pill (Opens 16-MBTI Menu!) */}
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
                  {store.persona.roleTag} · {store.persona.mbti}
                </div>
              </div>
            </div>

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

        {/* SUB-HEADER ROW */}
        <div className="relative z-20 px-4 pt-2.5 flex items-center justify-between gap-2 max-w-xl mx-auto">
          <button
            onClick={() => openRandomSnowmanCreation()}
            title="雪球随机创作"
            className="w-11 h-11 rounded-full bg-[#fdfbf7]/95 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex items-center justify-center active:scale-95 transition cursor-pointer shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#c86d1f]">
              <path d="M14 5v4C7 9 4 14 3 19c2.5-3.5 6-5.1 11-5.1V18l7-6.5L14 5z" />
            </svg>
          </button>

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

            {/* Published Count */}
            <button
              onClick={() =>
                store.publishedAnswers.length > 0
                  ? setDrawer("replies")
                  : openRandomSnowmanCreation()
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

          <div className="w-11 h-11 shrink-0 pointer-events-none" aria-hidden="true" />
        </div>

        {/* LEFT VERTICAL BUTTONS */}
        <div className="absolute left-4 top-[178px] z-20 flex flex-col gap-3.5">
          {/* MBTI Gear */}
          <button
            onClick={() => setDrawer("settings")}
            className="w-11 h-11 rounded-full bg-[#fdfbf7]/94 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex items-center justify-center active:scale-95 transition cursor-pointer"
            title="性格波长 MBTI"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#c86d1f]">
              <path d="M12 2a2.4 2.4 0 0 1 2.2 1.5 2.4 2.4 0 0 1 2.7-.5 2.4 2.4 0 0 1 1.1 2.5 2.4 2.4 0 0 1 2.1 1.6 2.4 2.4 0 0 1-.6 2.7 2.4 2.4 0 0 1 .6 2.7 2.4 2.4 0 0 1-2.1 1.6 2.4 2.4 0 0 1-1.1 2.5 2.4 2.4 0 0 1-2.7-.5A2.4 2.4 0 0 1 12 22a2.4 2.4 0 0 1-2.2-1.5 2.4 2.4 0 0 1-2.7.5 2.4 2.4 0 0 1-1.1-2.5 2.4 2.4 0 0 1-2.1-1.6 2.4 2.4 0 0 1 .6-2.7 2.4 2.4 0 0 1-.6-2.7A2.4 2.4 0 0 1 6 5.1a2.4 2.4 0 0 1 1.1-2.5 2.4 2.4 0 0 1 2.7.5A2.4 2.4 0 0 1 12 2zm0 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
            </svg>
          </button>

          {/* Replies / Community Echoes Bell */}
          <button
            onClick={() => setDrawer("replies")}
            className="relative w-11 h-11 rounded-full bg-[#fdfbf7]/94 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex items-center justify-center active:scale-95 transition cursor-pointer"
            title="雪球收到的回音"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#c86d1f]">
              <path d="M12 3a5 5 0 0 0-5 5v3.2L5.3 13.8a1 1 0 0 0 .8 1.6h11.8a1 1 0 0 0 .8-1.6L17 11.2V8a5 5 0 0 0-5-5zm-2 14a2 2 0 0 0 4 0h-4z" />
            </svg>
            {store.publishedAnswers.length > 0 && (
              <span className="absolute top-2 right-2.5 w-2.5 h-2.5 rounded-full bg-[#f97316] border-2 border-[#fdfbf7]" />
            )}
          </button>

          {/* Burrow History Quick Entry */}
          <button
            onClick={() => setDrawer("burrow")}
            className="w-11 h-11 rounded-full bg-[#fdfbf7]/94 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex items-center justify-center active:scale-95 transition cursor-pointer"
            title="树洞聊天记录"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <rect x="6" y="4" width="13" height="16" rx="3" fill="#c86d1f" />
              <line x1="4.5" y1="8" x2="7.5" y2="8" stroke="#fdfbf7" strokeWidth="2" strokeLinecap="round" />
              <line x1="4.5" y1="12" x2="7.5" y2="12" stroke="#fdfbf7" strokeWidth="2" strokeLinecap="round" />
              <line x1="4.5" y1="16" x2="7.5" y2="16" stroke="#fdfbf7" strokeWidth="2" strokeLinecap="round" />
              <path d="M11 14.5l4-4 1.5 1.5-4 4H11v-1.5z" fill="#fdfbf7" />
            </svg>
          </button>

          {/* 3D / 2D Switcher */}
          <button
            onClick={() => {
              const next = renderMode === "3d" ? "2d" : "3d";
              setRenderMode(next);
              showToast(next === "2d" ? "已切换为绘本 2D 看山" : "已切换为立体 3D 看山");
            }}
            className="w-11 h-11 rounded-full bg-[#fdfbf7]/94 shadow-[0_3px_10px_rgba(120,150,190,0.18)] flex flex-col items-center justify-center active:scale-95 transition cursor-pointer"
          >
            <span className="text-[13px] font-bold text-[#c86d1f] leading-none">
              {renderMode === "3d" ? "2D" : "3D"}
            </span>
            <span className="text-[9px] font-semibold text-[#9e6534] mt-0.5 leading-none">
              画风
            </span>
          </button>
        </div>

        {/* EXPERIENCE-LINKED TOPIC QUESTION BUBBLE */}
        {toast ? (
          <div className="absolute top-[166px] left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-[#52657c]/85 backdrop-blur-md text-white text-[13px] font-medium shadow-sm whitespace-nowrap">
            {toast}
          </div>
        ) : (
          <button
            onClick={() => setDrawer("burrow")}
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
            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#fdfbf7]/94 rotate-45" />
          </button>
        )}

        {/* FULL-BLEED 3D OR 2D STAGE */}
        <div className="absolute inset-0 z-0">
          {renderMode === "3d" ? (
            <KanShanStage3D
              pet={store.pet}
              hoardedItems={store.hoardedItems}
              isHuntingTreasure={isHuntingTreasure}
              isRecordingNose={isRecordingNose}
              onTapHead={() => {
                showToast("蹭了蹭你的手心（长按黑鼻子可录玩偶悄悄话）");
                postState({ action: "hardware_interact", interactType: "head_pat" });
              }}
              onTapNoseStart={handleNoseStart}
              onTapNoseEnd={handleNoseEnd}
              onTapSnowman={() => openRandomSnowmanCreation()}
              onSelectHoardItem={handleSelectHoardInRoom}
            />
          ) : (
            <KanShanStage2D
              pet={store.pet}
              hoardedItems={store.hoardedItems}
              isHuntingTreasure={isHuntingTreasure}
              isRecordingNose={isRecordingNose}
              onTapHead={() => {
                showToast("蹭了蹭你的手心（长按黑鼻子可录玩偶悄悄话）");
                postState({ action: "hardware_interact", interactType: "head_pat" });
              }}
              onTapNoseStart={handleNoseStart}
              onTapNoseEnd={handleNoseEnd}
              onTapSnowman={() => openRandomSnowmanCreation()}
              onSelectHoardItem={handleSelectHoardInRoom}
            />
          )}
        </div>

        {/* RIGHT TRANSLUCENT PILL (喂食 + 树洞) */}
        <div className="absolute right-4 top-[250px] z-20 w-[62px] py-3.5 rounded-full bg-white/58 backdrop-blur-md border border-white/70 shadow-[0_6px_24px_rgba(125,158,200,0.18)] flex flex-col items-center gap-4">
          <button
            onClick={handleFeedCodfish}
            className="relative flex flex-col items-center gap-1 active:scale-95 transition cursor-pointer"
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
            {(store.pet.codfishCount || 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 px-1.5 rounded-full bg-[#38bdf8] text-white text-[10px] font-bold">
                {store.pet.codfishCount}
              </span>
            )}
            <span className="text-[13px] font-bold text-[#784315]">喂食</span>
          </button>

          <button
            onClick={() => setDrawer("burrow")}
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

        {/* BOTTOM SNOW DOME (`出门`) */}
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
        {/* MODULE A: SNOWBALL RANDOM 3-MODE CREATION MODAL               */}
        {/* ============================================================= */}
        {drawer === "snowman" && (
          <SnowballCreationSheet
            store={store}
            initialMode={snowballMode}
            preferredSessionId={preferredSnowSessionId}
            onClose={() => setDrawer(null)}
            onStoreChange={setStore}
            onJumpToBurrow={(sessionId) => {
              if (sessionId) setStore(apiSelectChatSession(sessionId));
              setDrawer("burrow");
            }}
            onConfirmPublished={handleConfirmSnowballPublished}
            showToast={showToast}
          />
        )}

        {/* ============================================================= */}
        {/* MODULE B: DUAL-PANE BURROW AI CHAT + DOLL VOICE RECORDS       */}
        {/* ============================================================= */}
        {drawer === "burrow" && (
          <BurrowChatModal
            store={store}
            onStoreChange={setStore}
            onClose={() => setDrawer(null)}
            onGenerateSnowballFromSession={(sessionId) =>
              openRandomSnowmanCreation(sessionId)
            }
            showToast={showToast}
          />
        )}

        {/* ============================================================= */}
        {/* OTHER COZY BOTTOM SHEETS (Wardrobe / Nose Voice / Treasure / Settings) */}
        {/* ============================================================= */}
        {drawer && drawer !== "snowman" && drawer !== "burrow" && (
          <div
            className="absolute inset-0 z-40 bg-[#334e68]/18 backdrop-blur-[2px] flex items-end justify-center"
            onClick={() => setDrawer(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-[36px] bg-[#f9fbff]/96 backdrop-blur-xl border-t border-white shadow-[0_-12px_40px_rgba(65,98,145,0.18)] p-5 pb-7 max-h-[68%] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      drawer === "nose_voice"
                        ? `${BASE_PATH}/kanshan-anim/sleepy.gif`
                        : `${BASE_PATH}/kanshan-anim/idle.gif`
                    }
                    alt=""
                    className="w-9 h-9 object-contain"
                  />
                  <span className="text-[16px] font-bold text-[#6e4720]">
                    {drawer === "wardrobe" && "小衣柜"}
                    {drawer === "nose_voice" && "3D 玩偶鼻头录音已捕捉"}
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

              {/* 3D DOLL NOSE VOICE CONFIRMATION */}
              {drawer === "nose_voice" && (
                <div className="space-y-3">
                  <div className="text-[12.5px] text-[#647890]">
                    确认或微调刚才对着看山黑鼻子说的话，保存后会同步到树洞「来自玩偶的声音」：
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {NOSE_VOICE_PRESETS.map((preset, i) => (
                      <button
                        key={i}
                        onClick={() => setNoseTranscript(preset)}
                        className="px-2.5 py-1 rounded-full bg-white border border-[#e2ecf9] text-[11.5px] text-[#6e5a49] hover:bg-[#fff9eb] cursor-pointer"
                      >
                        示例 {i + 1}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    value={noseTranscript}
                    onChange={(e) => setNoseTranscript(e.target.value)}
                    placeholder="在这里检查或补充语音转写内容…"
                    className="w-full rounded-[20px] bg-white border border-[#dde9f8] p-3.5 text-[13px] text-[#4c3b2e] focus:outline-none"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setDrawer("burrow")}
                      className="px-4 py-2 rounded-full bg-white text-[12.5px] font-bold text-[#528be0] cursor-pointer"
                    >
                      去树洞查看全部
                    </button>
                    <button
                      disabled={!noseTranscript.trim()}
                      onClick={handleSaveNoseVoice}
                      className="px-5 py-2.5 rounded-full bg-[#63a4f7] disabled:opacity-40 text-white text-[13px] font-bold cursor-pointer"
                    >
                      保存到「来自玩偶的声音」
                    </button>
                  </div>
                </div>
              )}

              {/* DIRECT ROOM TREASURE CARD */}
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
                            分享的内容收到了 {ans.upvotes} 份赞同 · 小银鳕鱼 +1
                          </span>
                          <span className="text-[11px] text-[#a38b73]">{ans.createdAt}</span>
                        </div>
                        <div className="text-[12.5px] font-bold text-[#4c3b2e]">
                          {ans.questionTitle}
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
                      还没有确认发布过雪球内容，点看山身旁的雪球就能随机触发创作草稿啦。
                    </div>
                  )}
                </div>
              )}

              {/* SETTINGS: 16-MBTI PERSONAL SELECTION MENU */}
              {drawer === "settings" && (() => {
                const allMbti = MBTI_MENU_GROUPS.flatMap((g) => g.items);
                const curItem =
                  allMbti.find((m) => m.code === store.persona.mbti) || allMbti[0];
                return (
                  <div className="space-y-3">
                    <div className="rounded-[22px] bg-white shadow-[0_2px_12px_rgba(148,179,214,0.14)] border border-[#e3eefb] overflow-hidden">
                      <button
                        onClick={() => setMbtiMenuOpen(!mbtiMenuOpen)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-[#f6faff] transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 text-left">
                          <span className="px-2.5 py-1 rounded-xl bg-[#63a4f7] text-white text-[12px] font-bold">
                            {curItem.code}
                          </span>
                          <div>
                            <div className="text-[13px] font-bold text-[#4c3b2e]">
                              我的 MBTI · {curItem.title}
                            </div>
                            <div className="text-[11px] text-[#8496ab]">{curItem.desc}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[12px] font-semibold text-[#528be0]">
                          <span>{mbtiMenuOpen ? "收起菜单" : "选择 MBTI"}</span>
                          <svg
                            viewBox="0 0 20 20"
                            className={`w-4 h-4 transition-transform ${
                              mbtiMenuOpen ? "rotate-180" : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="5 8 10 13 15 8" />
                          </svg>
                        </div>
                      </button>

                      {mbtiMenuOpen && (
                        <div className="border-t border-[#edf3fc] max-h-52 overflow-y-auto px-2.5 py-2 space-y-2.5 bg-[#fbfdff]">
                          {MBTI_MENU_GROUPS.map((grp) => (
                            <div key={grp.group} className="space-y-1">
                              <div className="px-2 text-[11px] font-bold text-[#8ea2ba]">
                                {grp.group}
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                {grp.items.map((item) => {
                                  const active = store.persona.mbti === item.code;
                                  return (
                                    <button
                                      key={item.code}
                                      onClick={() => {
                                        postState({ action: "update_persona", mbti: item.code });
                                        setMbtiMenuOpen(false);
                                        showToast(`已切换为 ${item.code} · ${item.title}`);
                                      }}
                                      className={`px-3 py-2 rounded-[14px] flex items-center justify-between text-left transition cursor-pointer ${
                                        active
                                          ? "bg-[#e3f0ff] ring-1.5 ring-[#63a4f7]"
                                          : "bg-white hover:bg-[#f2f7fe] border border-[#eef4fb]"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className={`text-[12px] font-bold ${
                                              active ? "text-[#2b6cb0]" : "text-[#4c3b2e]"
                                            }`}
                                          >
                                            {item.code}
                                          </span>
                                          <span className="text-[11px] font-semibold text-[#7a6552]">
                                            {item.title}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-[#8b9bb0] truncate">
                                          {item.desc}
                                        </div>
                                      </div>
                                      {active && (
                                        <svg
                                          viewBox="0 0 16 16"
                                          className="w-4 h-4 text-[#3b82f6] shrink-0 ml-1"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.4"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
                                        </svg>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-[20px] bg-[#edf5ff]/85">
                      <div className="text-[13px] font-bold text-[#4c3b2e]">
                        {store.persona.mirrorTrait}
                      </div>
                      <p className="text-[12px] text-[#697d95] mt-1 leading-relaxed">
                        {store.persona.speakingStyle}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        postState({ action: "reset_storyline" });
                        setDrawer(null);
                        showToast("已回到最初");
                      }}
                      className="w-full py-2.5 rounded-full bg-[#edf3fa] hover:bg-[#e1ecf8] text-[13px] font-bold text-[#647890] cursor-pointer"
                    >
                      回到最初
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
