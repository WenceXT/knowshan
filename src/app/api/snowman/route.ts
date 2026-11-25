import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import { desensitizeAndComposeDraft } from "@/lib/ai-engine";

export async function POST(req: Request) {
  const body = await req.json();
  const store = readStore();
  const question =
    store.questions.find((q) => q.id === (body.questionId || store.activeQuestionId)) ||
    store.questions[0];

  if (body.action === "generate_draft") {
    const dialogue = store.dialogues[question.id] || [];
    const draft = desensitizeAndComposeDraft(question, store.whispers, dialogue, store.persona);
    return NextResponse.json({ draft, question });
  }

  if (body.action === "publish") {
    const content = String(body.content || "").trim();
    const desensitized = Boolean(body.desensitized ?? true);
    const redactedTerms = Array.isArray(body.redactedTerms) ? body.redactedTerms : [];

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const published = {
      id: `ans-${Date.now()}`,
      questionId: question.id,
      questionTitle: question.title,
      content,
      desensitized,
      redactedTerms,
      createdAt: `今天 ${timeStr}`,
      upvotes: 12,
      warmComments: [
        {
          author: "阿泽在赶论文",
          avatar: "🦊",
          text: "大半夜刷到这篇差点看哭！明天下午我也要第一次全英文 Pre，看到『关键词手卡』瞬间不那么慌了，谢谢答主真实的分享！",
          time: "刚刚 · 广东",
        },
        {
          author: "知乎小透明",
          avatar: "🌱",
          text: "已赞同+收藏！比那些教你像乔布斯一样演讲的鸡汤实用一万倍，真实经历永远最打动人。",
          time: "1 分钟前 · 北京",
        },
      ],
    };

    store.publishedAnswers = [published, ...store.publishedAnswers];
    store.persona.zhihuStats.publishedCount += 1;
    store.pet.exp += 120;
    store.pet.level = Math.floor(store.pet.exp / 120) + 1;
    store.pet.snowballProgress = 15;
    store.pet.mood = "happy";
    store.pet.statusMessage =
      "🎉 破冰成功！你完成了从「沉默浏览者」到「真实创作者」的蜕变，收到第一批知友赞同，经验值 +120！";
    store.pet.lastSyncAt = `${timeStr} · 创作激励已同步至双端`;

    writeStore(store);
    return NextResponse.json({ store, published });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
