export type PetMood =
  | "calm"
  | "happy"
  | "sly"
  | "listening"
  | "sleepy"
  | "night_owl"
  | "sleeping";

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
  role: "kanshan" | "user";
  content: string;
  createdAt: string;
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
  questionId: string;
  questionTitle: string;
  content: string;
  desensitized: boolean;
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
  hoardedItems: HoardedItem[];
  publishedAnswers: PublishedAnswer[];
}
