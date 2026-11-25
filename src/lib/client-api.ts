"use client";

import { ACCESSORIES, ALL_HOARD_TREASURES, createInitialStore } from "@/lib/seed";
import {
  analyzeWhisperText,
  autoTitleFromText,
  composeSnowballBundle,
  computePersonaMirror,
  generateBurrowChatReply,
} from "@/lib/ai-engine";
import {
  AccessoryItem,
  ChatMessage,
  ChatSession,
  DollVoiceRecord,
  KnowShanStore,
  PetMood,
  PostSubFormat,
  SavedSnowballDraft,
  SnowballCreationMode,
  SnowballDraftBundle,
} from "@/types/knowshan";

const STORAGE_KEY = "knowshan_store_v10";
const IS_STATIC = process.env.NEXT_PUBLIC_STATIC_MODE === "true";

function normalizeStore(s: KnowShanStore): KnowShanStore {
  const fallback = createInitialStore();
  if (!Array.isArray(s.chatSessions) || s.chatSessions.length === 0) {
    s.chatSessions = fallback.chatSessions;
    s.activeSessionId = fallback.activeSessionId;
  }
  if (!s.activeSessionId && s.chatSessions[0]) {
    s.activeSessionId = s.chatSessions[0].id;
  }
  if (!Array.isArray(s.dollVoiceRecords)) {
    s.dollVoiceRecords = fallback.dollVoiceRecords;
  }
  if (!Array.isArray(s.savedDrafts)) {
    s.savedDrafts = [];
  }
  if (typeof s.pet.codfishCount !== "number") {
    s.pet.codfishCount = 2;
  }
  return s;
}

function loadLocalStore(): KnowShanStore {
  if (typeof window === "undefined") return createInitialStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeStore(JSON.parse(raw) as KnowShanStore);
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
  if (!IS_STATIC) {
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_store", store }),
    }).catch(() => {});
  }
  return store;
}

function nowHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export async function apiGetState(): Promise<{
  store: KnowShanStore;
  accessories: AccessoryItem[];
}> {
  if (!IS_STATIC) {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        if (data?.store) {
          const norm = normalizeStore(data.store);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(norm));
          }
          return { store: norm, accessories: data.accessories || ACCESSORIES };
        }
      }
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
  const store = loadLocalStore();
  const syncTime = `${nowHHMM()} · 已同步`;

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
    } else if (type === "feed_codfish") {
      if ((store.pet.codfishCount || 0) > 0) {
        store.pet.codfishCount = Math.max(0, (store.pet.codfishCount || 1) - 1);
      }
      store.pet.mood = "happy";
      store.pet.energy = Math.min(100, store.pet.energy + 10);
      store.pet.exp += 12;
      store.pet.statusMessage = "啊呜吃掉了一小块银鳕鱼，尾巴摇个不停";
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
    return { store: saveLocalStore(store), accessories: ACCESSORIES };
  }

  if (payload.action === "toggle_accessory") {
    const itemId = payload.itemId as string;
    const item = ACCESSORIES.find((a) => a.id === itemId);
    if (!item) return { error: "未找到该配饰" };
    if (!store.pet.unlockedItems.includes(itemId)) {
      if (store.pet.exp < item.costExp) {
        return { error: "经验还差一点，先去树洞聊聊或分享雪球吧" };
      }
      store.pet.unlockedItems.push(itemId);
    }
    if (store.pet.equippedItems.includes(itemId)) {
      store.pet.equippedItems = store.pet.equippedItems.filter((id) => id !== itemId);
    } else {
      store.pet.equippedItems.push(itemId);
    }
    store.pet.lastSyncAt = syncTime;
    return { store: saveLocalStore(store), accessories: ACCESSORIES };
  }

  if (payload.action === "update_persona") {
    if (typeof payload.mbti === "string") store.persona.mbti = payload.mbti;
    const mirror = computePersonaMirror(store.persona.mbti, store.persona.zhihuInterests);
    store.persona.mirrorTrait = mirror.mirrorTrait;
    store.persona.speakingStyle = mirror.speakingStyle;
    return { store: saveLocalStore(store), accessories: ACCESSORIES };
  }

  if (payload.action === "refresh_hoard") {
    const firstId = store.hoardedItems[0]?.id;
    const curIdx = ALL_HOARD_TREASURES.findIndex((t) => t.id === firstId);
    const nextStart = curIdx < 0 ? 0 : (curIdx + 3) % ALL_HOARD_TREASURES.length;
    store.hoardedItems = ALL_HOARD_TREASURES.slice(nextStart, nextStart + 3);
    store.pet.mood = "happy";
    store.pet.exp += 10;
    store.pet.level = Math.floor(store.pet.exp / 120) + 1;
    store.pet.statusMessage = "刚从知乎雪原逛回来，给你叼了三件发光的新宝贝放屋里啦";
    return { store: saveLocalStore(store), accessories: ACCESSORIES };
  }

  return { store: saveLocalStore(store), accessories: ACCESSORIES };
}

// =========================================================================
// MODULE B: BURROW MULTI-SESSION AI CHAT + DOLL VOICE RECORDS
// =========================================================================

export function apiSelectChatSession(sessionId: string): KnowShanStore {
  const store = loadLocalStore();
  if (store.chatSessions.some((s) => s.id === sessionId)) {
    store.activeSessionId = sessionId;
  }
  return saveLocalStore(store);
}

export function apiCreateNewChatSession(initialTitle?: string): KnowShanStore {
  const store = loadLocalStore();
  const timeStr = nowHHMM();
  const newSession: ChatSession = {
    id: `sess-${Date.now()}`,
    title: initialTitle || "新的树洞对话",
    createdAt: `今天 ${timeStr}`,
    updatedAt: timeStr,
    source: "web",
    allowForCreation: true,
    messages: [
      {
        id: `m-welcome-${Date.now()}`,
        role: "kanshan",
        content: `新翻开一页树洞啦～想吐槽今天的小插曲、聊点拿不定主意的事，或者单纯发会儿呆都可以，我都听着呢。`,
        inputType: "text",
        source: "web",
        createdAt: timeStr,
      },
    ],
  };
  store.chatSessions = [newSession, ...store.chatSessions];
  store.activeSessionId = newSession.id;
  return saveLocalStore(store);
}

export function apiDeleteChatSession(sessionId: string): KnowShanStore {
  const store = loadLocalStore();
  store.chatSessions = store.chatSessions.filter((s) => s.id !== sessionId);
  if (store.chatSessions.length === 0) {
    return apiCreateNewChatSession("新的树洞对话");
  }
  if (store.activeSessionId === sessionId) {
    store.activeSessionId = store.chatSessions[0].id;
  }
  return saveLocalStore(store);
}

export function apiClearAllChatSessions(): KnowShanStore {
  const store = loadLocalStore();
  store.chatSessions = [];
  saveLocalStore(store);
  return apiCreateNewChatSession("清空后的新对话");
}

export function apiToggleSessionPermission(sessionId: string): KnowShanStore {
  const store = loadLocalStore();
  const target = store.chatSessions.find((s) => s.id === sessionId);
  if (target) {
    target.allowForCreation = !target.allowForCreation;
  }
  return saveLocalStore(store);
}

export async function apiSendBurrowMessage(params: {
  sessionId?: string;
  content: string;
  inputType?: "text" | "voice";
  source?: "web" | "doll";
  audioUrl?: string;
  durationSec?: number;
}): Promise<{ store: KnowShanStore }> {
  const store = loadLocalStore();
  const timeStr = nowHHMM();
  let session =
    store.chatSessions.find((s) => s.id === (params.sessionId || store.activeSessionId)) ||
    store.chatSessions[0];

  if (!session) {
    session = {
      id: `sess-${Date.now()}`,
      title: autoTitleFromText(params.content),
      createdAt: `今天 ${timeStr}`,
      updatedAt: timeStr,
      source: params.source === "doll" ? "doll" : "web",
      allowForCreation: true,
      messages: [],
    };
    store.chatSessions = [session];
  }

  const userMsg: ChatMessage = {
    id: `u-${Date.now()}`,
    sessionId: session.id,
    role: "user",
    content: params.content.trim(),
    inputType: params.inputType || "text",
    source: params.source || "web",
    audioUrl: params.audioUrl,
    durationSec: params.durationSec,
    createdAt: timeStr,
  };

  session.messages = [...session.messages, userMsg];
  session.updatedAt = timeStr;
  if (session.title === "新的树洞对话" || session.title === "清空后的新对话") {
    session.title = autoTitleFromText(params.content);
  }
  if (params.source === "doll" && session.source === "web") {
    session.source = "mixed";
  }

  // Also analyze whisper to keep the top experience-linked question bubble synchronized!
  const whisperEntry = await analyzeWhisperText(
    params.content,
    params.source === "doll" ? "hardware_nose" : "web_diary",
    store.persona
  );
  store.whispers = [whisperEntry, ...store.whispers.slice(0, 14)];
  if (whisperEntry.matchedQuestionIds.length > 0) {
    store.activeQuestionId = whisperEntry.matchedQuestionIds[0];
  }

  const replyText = await generateBurrowChatReply(
    session.messages,
    params.content,
    store.persona
  );

  const botMsg: ChatMessage = {
    id: `k-${Date.now() + 1}`,
    sessionId: session.id,
    role: "kanshan",
    content: replyText,
    inputType: "text",
    source: "web",
    createdAt: timeStr,
  };

  session.messages = [...session.messages, botMsg];
  store.activeSessionId = session.id;
  // Move active session to top of recents
  store.chatSessions = [
    session,
    ...store.chatSessions.filter((s) => s.id !== session!.id),
  ];

  store.pet.exp += 20;
  store.pet.level = Math.floor(store.pet.exp / 120) + 1;
  store.pet.snowballProgress = Math.min(100, store.pet.snowballProgress + 32);
  store.pet.mood = "happy";

  return { store: saveLocalStore(store) };
}

/**
 * Saves a voice recording captured via the 3D/2D Doll Nose Interaction into "来自玩偶的声音"
 */
export async function apiAddDollVoiceRecord(params: {
  transcript: string;
  durationSec: number;
  audioUrl?: string;
}): Promise<{ store: KnowShanStore; record: DollVoiceRecord }> {
  const store = loadLocalStore();
  const timeStr = nowHHMM();
  const record: DollVoiceRecord = {
    id: `vr-${Date.now()}`,
    transcript: params.transcript.trim(),
    durationSec: Math.max(1, Math.round(params.durationSec)),
    audioUrl: params.audioUrl,
    sourceLabel: "3D 玩偶鼻头录音",
    createdAt: `今天 ${timeStr}`,
    allowForCreation: true,
  };
  store.dollVoiceRecords = [record, ...store.dollVoiceRecords];

  const whisperEntry = await analyzeWhisperText(
    record.transcript,
    "hardware_nose",
    store.persona
  );
  store.whispers = [whisperEntry, ...store.whispers.slice(0, 14)];
  if (whisperEntry.matchedQuestionIds.length > 0) {
    store.activeQuestionId = whisperEntry.matchedQuestionIds[0];
  }

  store.pet.exp += 25;
  store.pet.level = Math.floor(store.pet.exp / 120) + 1;
  store.pet.snowballProgress = Math.min(100, store.pet.snowballProgress + 35);
  store.pet.mood = "happy";
  store.pet.lastSyncAt = `${timeStr} · 玩偶语音已收录进树洞`;

  return { store: saveLocalStore(store), record };
}

export function apiContinueFromDollVoice(voiceId: string): {
  store: KnowShanStore;
  sessionId: string;
} {
  const store = loadLocalStore();
  const voice = store.dollVoiceRecords.find((v) => v.id === voiceId);
  if (!voice) return { store, sessionId: store.activeSessionId };

  if (voice.linkedSessionId) {
    const existing = store.chatSessions.find((s) => s.id === voice.linkedSessionId);
    if (existing) {
      store.activeSessionId = existing.id;
      return { store: saveLocalStore(store), sessionId: existing.id };
    }
  }

  const timeStr = nowHHMM();
  const newSess: ChatSession = {
    id: `sess-doll-${Date.now()}`,
    title: autoTitleFromText(voice.transcript),
    createdAt: `今天 ${timeStr}`,
    updatedAt: timeStr,
    source: "doll",
    allowForCreation: voice.allowForCreation,
    linkedVoiceId: voice.id,
    messages: [
      {
        id: `dm-u-${Date.now()}`,
        role: "user",
        content: voice.transcript,
        inputType: "voice",
        source: "doll",
        audioUrl: voice.audioUrl,
        durationSec: voice.durationSec,
        createdAt: voice.createdAt,
      },
      {
        id: `dm-k-${Date.now() + 1}`,
        role: "kanshan",
        content: `之前听你对着玩偶念叨过这段话：「${voice.transcript.slice(0, 28)}${
          voice.transcript.length > 28 ? "…" : ""
        }」——现在回头看，心情有没有松快一点？想接着跟我聊聊吗？`,
        inputType: "text",
        source: "web",
        createdAt: timeStr,
      },
    ],
  };

  voice.linkedSessionId = newSess.id;
  store.chatSessions = [newSess, ...store.chatSessions];
  store.activeSessionId = newSess.id;
  return { store: saveLocalStore(store), sessionId: newSess.id };
}

export function apiDeleteDollVoice(voiceId: string): KnowShanStore {
  const store = loadLocalStore();
  store.dollVoiceRecords = store.dollVoiceRecords.filter((v) => v.id !== voiceId);
  return saveLocalStore(store);
}

// =========================================================================
// MODULE A: SNOWBALL 3-MODE CREATION SYSTEM
// =========================================================================

export function apiBuildSnowballBundle(
  preferredSessionId?: string,
  preferredQuestionId?: string
): SnowballDraftBundle {
  const store = loadLocalStore();
  return composeSnowballBundle(store, preferredSessionId, preferredQuestionId);
}

export function apiSaveSnowballDraft(draft: Omit<SavedSnowballDraft, "id" | "updatedAt">): KnowShanStore {
  const store = loadLocalStore();
  const saved: SavedSnowballDraft = {
    ...draft,
    id: `draft-${Date.now()}`,
    updatedAt: `今天 ${nowHHMM()}`,
  };
  store.savedDrafts = [saved, ...store.savedDrafts.slice(0, 9)];
  return saveLocalStore(store);
}

export async function apiConfirmSnowballPublished(payload: {
  creationType: SnowballCreationMode;
  questionId: string;
  title: string;
  content: string;
  desensitized: boolean;
  redactedTerms: string[];
}): Promise<{ store: KnowShanStore }> {
  const store = loadLocalStore();
  const timeStr = nowHHMM();

  store.publishedAnswers = [
    {
      id: `ans-${Date.now()}`,
      creationType: payload.creationType,
      questionId: payload.questionId,
      questionTitle: payload.title,
      content: payload.content,
      desensitized: payload.desensitized,
      redactedTerms: payload.redactedTerms,
      createdAt: `今天 ${timeStr}`,
      upvotes: 12,
      warmComments: [
        {
          author: "阿泽在赶论文",
          avatar: "",
          text: "大半夜刷到这篇真的太有共鸣了！谢谢这么真诚又接地气的分享，看完心里踏实了好多！",
          time: "刚刚",
        },
        {
          author: "知乎小透明",
          avatar: "",
          text: "已赞同+收藏！真实走过来的小经验永远比大道理最打动人。",
          time: "1 分钟前",
        },
      ],
    },
    ...store.publishedAnswers,
  ];

  store.persona.zhihuStats.publishedCount += 1;
  store.pet.exp += 120;
  store.pet.level = Math.floor(store.pet.exp / 120) + 1;
  store.pet.codfishCount = (store.pet.codfishCount || 0) + 1;
  // Melt snowball back to Stage 1 (1 single ball) so a new snowball cycle begins!
  store.pet.snowballProgress = 15;
  store.pet.mood = "happy";
  store.pet.lastSyncAt = `${timeStr} · 雪球已化作一条小银鳕鱼`;

  return { store: saveLocalStore(store) };
}

// Legacy wrappers kept for compatibility
export async function apiSubmitWhisper(
  rawText: string,
  source: "hardware_nose" | "web_diary"
): Promise<{ store: KnowShanStore }> {
  if (source === "hardware_nose") {
    const res = await apiAddDollVoiceRecord({ transcript: rawText, durationSec: 8 });
    return { store: res.store };
  }
  return apiSendBurrowMessage({ content: rawText, inputType: "text", source: "web" });
}

export async function apiSendBubble(
  _questionId: string,
  message: string
): Promise<{ store: KnowShanStore }> {
  return apiSendBurrowMessage({ content: message, inputType: "text", source: "web" });
}
