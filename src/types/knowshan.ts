export type PetMood =
  | "calm"
  | "happy"
  | "sly"
  | "listening"
  | "sleepy"
  | "night_owl"
  | "sleeping";

export type SnowballCreationMode = "ask" | "answer" | "post";
export type PostSubFormat = "article" | "pin";

export interface PersonaProfile {
  nickname: string;
  mbti: string;
  roleTag: string;
  zhihuInterests: string[];
  oauthConnected: boolean;
  zhihuStats: {
    browsedCount: number;
    savedCount: number;
    publishedCount: number;
    silentDays: number;
  };
  mirrorTrait: string;
  speakingStyle: string;
}

export interface AccessoryItem {
  id: string;
  name: string;
  icon: string;
  costExp: number;
  description: string;
  slot: "neck" | "eyes" | "head" | "hand";
}

export interface PetState {
  mood: PetMood;
  energy: number;
  hasDarkCircles: boolean;
  exp: number;
  level: number;
  codfishCount?: number;
  snowballProgress: number;
  unlockedItems: string[];
  equippedItems: string[];
  lastSyncAt: string;
  statusMessage: string;
}

export interface WhisperEntry {
  id: string;
  createdAt: string;
  source: "hardware_nose" | "web_diary";
  rawText: string;
  emotionTag: string;
  emotionColor: string;
  structuredSummary: string;
  corePainPoint: string;
  hiddenValue: string;
  bubbleQuestion?: string;
  matchedQuestionIds: string[];
}

export interface ZhihuQuestion {
  id: string;
  title: string;
  bubblePrompt?: string;
  topic: string;
  followers: number;
  views: string;
  matchScore: number;
  matchReason: string;
  zhidaInsight: string;
  zhihuSearchUrl: string;
  keywords: string[];
}

export interface ChatMessage {
  id: string;
  sessionId?: string;
  role: "kanshan" | "user";
  content: string;
  inputType?: "text" | "voice";
  source?: "web" | "doll";
  audioUrl?: string;
  durationSec?: number;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  source: "web" | "doll" | "mixed";
  allowForCreation: boolean;
  linkedVoiceId?: string;
  messages: ChatMessage[];
}

export interface DollVoiceRecord {
  id: string;
  transcript: string;
  durationSec: number;
  audioUrl?: string;
  sourceLabel: string;
  createdAt: string;
  linkedSessionId?: string;
  allowForCreation: boolean;
}

export interface SnowballDraftBundle {
  sourceLabel: string;
  sourceSessionId?: string;
  redactedTerms: string[];
  // Mode 1: Ask a Zhihu Question
  askTitle: string;
  askDetail: string;
  askTopics: string[];
  // Mode 2: Answer an Existing Real Zhihu Question
  matchedQuestion: ZhihuQuestion;
  alternateQuestions: ZhihuQuestion[];
  answerDraft: string;
  answerDraftRaw: string;
  // Mode 3: Publish Standalone Post or Daily Pin ("想法")
  postTitle: string;
  articleBody: string;
  articleBodyRaw: string;
  pinBody: string;
  pinBodyRaw: string;
}

export interface SavedSnowballDraft {
  id: string;
  mode: SnowballCreationMode;
  postFormat: PostSubFormat;
  title: string;
  content: string;
  questionId?: string;
  desensitized: boolean;
  anonymousRequested: boolean;
  sourceSessionId?: string;
  updatedAt: string;
}

export interface HoardedItem {
  id: string;
  itemName: string;
  emoji: string;
  postTitle: string;
  author: string;
  upvotes: string;
  excerpt: string;
  reason: string;
  zhihuUrl: string;
  unlockedByWhisper?: boolean;
}

export interface PublishedAnswer {
  id: string;
  creationType?: SnowballCreationMode;
  questionId: string;
  questionTitle: string;
  content: string;
  desensitized: boolean;
  anonymousNote?: string;
  redactedTerms: string[];
  createdAt: string;
  upvotes: number;
  warmComments: { author: string; avatar: string; text: string; time: string }[];
}

export interface KnowShanStore {
  persona: PersonaProfile;
  pet: PetState;
  whispers: WhisperEntry[];
  questions: ZhihuQuestion[];
  activeQuestionId: string;
  dialogues: Record<string, ChatMessage[]>;
  // Module B: Multi-session Burrow AI Chat + Doll Voice Records
  chatSessions: ChatSession[];
  activeSessionId: string;
  dollVoiceRecords: DollVoiceRecord[];
  // Module A: Saved Snowball Drafts
  savedDrafts: SavedSnowballDraft[];
  hoardedItems: HoardedItem[];
  publishedAnswers: PublishedAnswer[];
}
