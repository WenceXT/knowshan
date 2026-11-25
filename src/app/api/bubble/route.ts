import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import { generateBubbleReply } from "@/lib/ai-engine";

export async function POST(req: Request) {
  const { questionId, message } = await req.json();
  if (!questionId || !message?.trim()) {
    return NextResponse.json({ error: "消息不能为空" }, { status: 400 });
  }

  const store = readStore();
  const question = store.questions.find((q) => q.id === questionId) || store.questions[0];
  const history = store.dialogues[question.id] || [];

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const userMsg = {
    id: `u-${Date.now()}`,
    role: "user" as const,
    content: String(message).trim(),
    createdAt: timeStr,
  };

  const updatedHistory = [...history, userMsg];
  const replyText = await generateBubbleReply(question, updatedHistory, userMsg.content, store.persona);

  const botMsg = {
    id: `k-${Date.now() + 1}`,
    role: "kanshan" as const,
    content: replyText,
    createdAt: timeStr,
  };

  store.dialogues[question.id] = [...updatedHistory, botMsg];
  store.activeQuestionId = question.id;
  store.pet.exp += 20;
  store.pet.level = Math.floor(store.pet.exp / 120) + 1;
  store.pet.snowballProgress = Math.min(100, store.pet.snowballProgress + 30);
  store.pet.lastSyncAt = `${timeStr} · 冒泡对话已沉淀至雪人草稿`;
  store.pet.statusMessage =
    store.pet.snowballProgress >= 80
      ? "雪人已经堆好啦！点击「堆雪人发帖邀请」即可预览 AI 隐私脱敏后的知乎回答草稿～"
      : "探讨得很有启发，雪球越滚越大了！";

  writeStore(store);
  return NextResponse.json({ store });
}
