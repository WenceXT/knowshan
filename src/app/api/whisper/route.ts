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
          content: `刚才听你说完「${entry.emotionTag}」，我悄悄在知乎上帮你找到了一个超同频的问题：《${q.title}》（${q.followers.toLocaleString()} 人关注）。不用有写作压力，我们先随便聊聊：回想刚才那件事，最让你感触深的一个小细节是什么？`,
          createdAt: entry.createdAt.replace("今天 ", ""),
        },
      ];
    }
  }

  store.pet.exp += 25;
  store.pet.level = Math.floor(store.pet.exp / 120) + 1;
  store.pet.snowballProgress = Math.min(100, store.pet.snowballProgress + 35);
  store.pet.mood = "happy";
  store.pet.lastSyncAt = `${entry.createdAt.replace("今天 ", "")} · 包挂语音已同步至网页端`;
  store.pet.statusMessage = `已将你的语音整理为「${entry.emotionTag}」卡片，雪球长大 35%，还匹配到了同频知乎问题！`;

  writeStore(store);
  return NextResponse.json({ store, entry });
}
