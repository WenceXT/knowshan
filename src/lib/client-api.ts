"use client";

import { ACCESSORIES, createInitialStore } from "@/lib/seed";
import {
  analyzeWhisperText,
  computePersonaMirror,
  desensitizeAndComposeDraft,
  generateBubbleReply,
} from "@/lib/ai-engine";
import { AccessoryItem, KnowShanStore, PetMood, ZhihuQuestion } from "@/types/knowshan";

const STORAGE_KEY = "knowshan_store_v2";
const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_MODE === "true";

function loadLocalStore(): KnowShanStore {
  if (typeof window === "undefined") return createInitialStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as KnowShanStore;
  } catch {
    // ignore
  }
  const fresh = createInitialStore();
  saveLocalStore(fresh);
  return fresh;
}

function saveLocalStore(store: KnowShanStore): KnowShanStore {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }
  return store;
}

export async function apiGetState(): Promise<{
  store: KnowShanStore;
  accessories: AccessoryItem[];
}> {
  if (!IS_STATIC) {
    try {
      const res = await fetch("/api/state");
      if (res.ok) return await res.json();
    } catch {
      // Fallback to browser storage
    }
  }
  return { store: loadLocalStore(), accessories: ACCESSORIES };
}

export async function apiPostState(payload: Record<string, unknown>): Promise<{
  store?: KnowShanStore;
  accessories?: AccessoryItem[];
  error?: string;
}> {
  if (!IS_STATIC) {
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok || data.error) return data;
    } catch {
      // Fallback to browser storage
    }
  }

  const store = loadLocalStore();
  const now = new Date();
  const syncTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · 已同步`;

  if (payload.action === "reset_storyline") {
    const fresh = saveLocalStore(createInitialStore());
    return { store: fresh, accessories: ACCESSORIES };
  }

  if (payload.action === "hardware_interact") {
    const type = payload.interactType as string;
    if (type === "head_pat") {
      store.pet.mood = "happy";
      store.pet.energy = Math.min(100, store.pet.energy + 6);
      store.pet.exp += 5;
      store.pet.statusMessage = "蹭了蹭你的手心，心情变好啦";
    } else if (type === "cheek_pinch") {
      store.pet.mood = "sly";
      store.pet.exp += 5;
      store.pet.statusMessage = "捏脸出气可以，捏完记得把吐槽留下来";
    } else if (type === "sleep_toggle") {
      const sleeping = store.pet.mood !== "sleeping";
      store.pet.mood = sleeping ? "sleeping" : "calm";
      store.pet.hasDarkCircles = false;
    } else if (type === "late_night_toggle") {
      store.pet.hasDarkCircles = !store.pet.hasDarkCircles;
      store.pet.mood = store.pet.hasDarkCircles ? ("night_owl" as PetMood) : "calm";
    }
    store.pet.level = Math.floor(store.pet.exp / 120) + 1;
    store.pet.lastSyncAt = syncTime;
    return { store: saveLocalStore(store) };
  }

  if (payload.action === "toggle_accessory") {
    const itemId = payload.itemId as string;
    const item = ACCESSORIES.find((a) => a.id === itemId);
    if (!item) return { error: "未找到该配饰" };
    if (!store.pet.unlockedItems.includes(itemId)) {
      if (store.pet.exp < item.costExp) {
        return { error: "经验还差一点，先去念叨两句或寄出雪球吧" };
      }
      store.pet.unlockedItems.push(itemId);
    }
    if (store.pet.equippedItems.includes(itemId)) {
      store.pet.equippedItems = store.pet.equippedItems.filter((id) => id !== itemId);
    } else {
      store.pet.equippedItems.push(itemId);
    }
    store.pet.lastSyncAt = syncTime;
    return { store: saveLocalStore(store) };
  }

  if (payload.action === "update_persona") {
    if (typeof payload.mbti === "string") store.persona.mbti = payload.mbti;
    const mirror = computePersonaMirror(store.persona.mbti, store.persona.zhihuInterests);
    store.persona.mirrorTrait = mirror.mirrorTrait;
    store.persona.speakingStyle = mirror.speakingStyle;
    return { store: saveLocalStore(store) };
  }

  if (payload.action === "select_question" && typeof payload.questionId === "string") {
    store.activeQuestionId = payload.questionId;
    return { store: saveLocalStore(store) };
  }

  return { store: saveLocalStore(store) };
}

export async function apiSubmitWhisper(
  rawText: string,
  source: "hardware_nose" | "web_diary"
): Promise<{ store: KnowShanStore }> {
  if (!IS_STATIC) {
    try {
      const res = await fetch("/api/whisper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, source }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }

  const store = loadLocalStore();
  const entry = await analyzeWhisperText(rawText, source, store.persona);
  store.whispers = [entry, ...store.whispers];
  if (entry.matchedQuestionIds.length > 0) {
    store.activeQuestionId = entry.matchedQuestionIds[0];
  }
  store.pet.exp += 25;
  store.pet.level = Math.floor(store.pet.exp / 120) + 1;
  store.pet.snowballProgress = Math.min(100, store.pet.snowballProgress + 35);
  store.pet.mood = "happy";
  return { store: saveLocalStore(store) };
}

export async function apiSendBubble(
  questionId: string,
  message: string
): Promise<{ store: KnowShanStore }> {
  if (!IS_STATIC) {
    try {
      const res = await fetch("/api/bubble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, message }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }

  const store = loadLocalStore();
  const q = store.questions.find((x) => x.id === questionId) || store.questions[0];
  const history = store.dialogues[q.id] || [];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const userMsg = { id: `u-${Date.now()}`, role: "user" as const, content: message, createdAt: timeStr };
  const updated = [...history, userMsg];
  const reply = await generateBubbleReply(q, updated, message, store.persona);
  const botMsg = { id: `k-${Date.now() + 1}`, role: "kanshan" as const, content: reply, createdAt: timeStr };

  store.dialogues[q.id] = [...updated, botMsg];
  store.pet.exp += 20;
  store.pet.level = Math.floor(store.pet.exp / 120) + 1;
  store.pet.snowballProgress = Math.min(100, store.pet.snowballProgress + 30);
  return { store: saveLocalStore(store) };
}

export async function apiGenerateDraft(questionId: string): Promise<{
  rawDraft: string;
  desensitizedDraft: string;
  redactedTerms: string[];
  question: ZhihuQuestion;
}> {
  if (!IS_STATIC) {
    try {
      const res = await fetch("/api/snowman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_draft", questionId }),
      });
      if (res.ok) {
        const d = await res.json();
        return { ...d.draft, question: d.question };
      }
    } catch {
      // Fallback
    }
  }

  const store = loadLocalStore();
  const q = store.questions.find((x) => x.id === questionId) || store.questions[0];
  const draft = desensitizeAndComposeDraft(q, store.whispers, store.dialogues[q.id] || [], store.persona);
  return { ...draft, question: q };
}

export async function apiPublishSnowman(payload: {
  questionId: string;
  content: string;
  desensitized: boolean;
  redactedTerms: string[];
}): Promise<{ store: KnowShanStore }> {
  if (!IS_STATIC) {
    try {
      const res = await fetch("/api/snowman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", ...payload }),
      });
      if (res.ok) return await res.json();
    } catch {
      // Fallback
    }
  }

  const store = loadLocalStore();
  const q = store.questions.find((x) => x.id === payload.questionId) || store.questions[0];
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  store.publishedAnswers = [
    {
      id: `ans-${Date.now()}`,
      questionId: q.id,
      questionTitle: q.title,
      content: payload.content,
      desensitized: payload.desensitized,
      redactedTerms: payload.redactedTerms,
      createdAt: `今天 ${timeStr}`,
      upvotes: 12,
      warmComments: [
        {
          author: "阿泽在赶论文",
          avatar: "",
          text: "大半夜刷到这篇差点看哭！明天下午我也要上台汇报，看到只写过渡关键词瞬间没那么慌了，谢谢分享！",
          time: "刚刚",
        },
      ],
    },
    ...store.publishedAnswers,
  ];
  store.persona.zhihuStats.publishedCount += 1;
  store.pet.exp += 120;
  store.pet.level = Math.floor(store.pet.exp / 120) + 1;
  store.pet.snowballProgress = 20;
  store.pet.mood = "happy";
  return { store: saveLocalStore(store) };
}
