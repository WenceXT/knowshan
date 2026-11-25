import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import { analyzeWhisperText } from "@/lib/ai-engine";

export async function POST(req: Request) {
  const { rawText, source = "hardware_nose" } = await req.json();
  if (!rawText || !String(rawText).trim()) {
    return NextResponse.json({ error: "倾诉内容不能为空" }, { status: 400 });
  }

  const store = readStore();
  const entry = await analyzeWhisperText(String(rawText), source, store.persona);

  store.whispers = [entry, ...store.whispers];
  if (entry.matchedQuestionIds.length > 0) {
    store.activeQuestionId = entry.matchedQuestionIds[0];
    // Seed an opening bubble message if none exists for this matched question
    const qId = entry.matchedQuestionIds[0];
    const q = store.questions.find((item) => item.id === qId);
    if (q && (!store.dialogues[qId] || store.dialogues[qId].length === 0)) {
      store.dialogues[qId] = [
        {
          id: `m-${Date.now()}`,
          role: "kanshan",
          content: `刚听你念叨完，我发现外面有 ${q.topic}这个话题：「${entry.bubbleQuestion || q.bubblePrompt || q.title}」——回想刚才那幕，最戳中你的一个小细节是什么呀？`,
          createdAt: entry.createdAt.replace("今天 ", ""),
        },
      ];
    }
  }

  store.pet.exp += 25;
  store.pet.level = Math.floor(store.pet.exp / 120) + 1;
  store.pet.snowballProgress = Math.min(100, store.pet.snowballProgress + 35);
  store.pet.mood = "happy";
  store.pet.lastSyncAt = `${entry.createdAt.replace("今天 ", "")} · 悄悄话已收进小窝`;
  store.pet.statusMessage = entry.bubbleQuestion || "给你吐了一个同频话题气泡，点开聊聊吧";

  writeStore(store);
  return NextResponse.json({ store, entry });
}
