import { QUESTION_POOL } from "@/lib/seed";
import { ChatMessage, PersonaProfile, WhisperEntry, ZhihuQuestion } from "@/types/knowshan";

async function callOptionalLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  if (!apiKey) return null;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.75,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export async function analyzeWhisperText(
  rawText: string,
  source: "hardware_nose" | "web_diary",
  persona: PersonaProfile
): Promise<WhisperEntry> {
  const text = rawText.trim();
  const matched = QUESTION_POOL.map((q) => {
    const hits = q.keywords.filter((kw) => text.toLowerCase().includes(kw.toLowerCase())).length;
    return { q, hits };
  })
    .sort((a, b) => b.hits - a.hits || b.q.matchScore - a.q.matchScore)
    .slice(0, 2)
    .map((x) => x.q.id);

  let emotionTag = "碎碎念";
  let emotionColor = "#f59e0b";
  let structuredSummary = "小看山把你刚才叹的这口气，轻轻折好收进口袋里啦。";
  let corePainPoint = "其实你已经做得很好了，不用事事都逼自己拿满分。";
  let hiddenValue = "外面正好也有人睡不着在聊这件事，你的经历也许能帮人松一口气。";

  if (/pre|演讲|汇报|上台|忘词|搞砸|答辩|紧张|社死/i.test(text)) {
    emotionTag = "有点委屈";
    emotionColor = "#f97316";
    structuredSummary = "上台太紧张脑子断片了，下台后还在一个人生自己的闷气。";
    corePainPoint = "越在乎就越容易发抖，真的一点都不丢人呀。";
    hiddenValue = "好多第一次上台的人也在手心冒汗，你的复盘能悄悄接住他们。";
  } else if (/熬夜|凌晨|失眠|睡不着|累|孤独|一个人|租房|独居/i.test(text)) {
    emotionTag = "夜里犯困";
    emotionColor = "#8b5cf6";
    structuredSummary = "忙完安静下来突然觉得空落落的，只想找个角落待一会儿。";
    corePainPoint = "白天撑得太用力了，晚上允许自己当一只蔫掉的小狐狸吧。";
    hiddenValue = "这份深夜的小切片很温柔，好多夜猫子刷到都会想给你点个赞。";
  }

  const llmReply = await callOptionalLLM(
    `你是一只住在主人桌角和包挂上的小北极狐「小看山」（主人性格：${persona.mbti}）。说话要完全没有AI味，不能用任何心理学大词、不能说教、不能分点列举！用软乎乎、嘴硬心软的老朋友口吻返回JSON：{"emotionTag":"4字内心情小贴纸","structuredSummary":"30字内像小动物记日记一样的暖心话","hiddenValue":"30字内轻轻提一句也有人在聊这个"}`,
    text
  );

  if (llmReply) {
    try {
      const parsed = JSON.parse(llmReply.replace(/```json|```/g, "").trim());
      if (parsed.emotionTag) emotionTag = parsed.emotionTag;
      if (parsed.structuredSummary) structuredSummary = parsed.structuredSummary;
      if (parsed.hiddenValue) hiddenValue = parsed.hiddenValue;
    } catch {
      // Keep warm default
    }
  }

  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");

  return {
    id: `w-${Date.now()}`,
    createdAt: `${hh}:${mm}`,
    source,
    rawText: text,
    emotionTag,
    emotionColor,
    structuredSummary,
    corePainPoint,
    hiddenValue,
    matchedQuestionIds: matched.length ? matched : ["q-pre-nervous"],
  };
}

export async function generateBubbleReply(
  question: ZhihuQuestion,
  history: ChatMessage[],
  userMessage: string,
  persona: PersonaProfile
): Promise<string> {
  const llmReply = await callOptionalLLM(
    `你是主人的小北极狐伙伴「小看山」（性格：${persona.mbti}，${persona.mirrorTrait}）。你们正趴在地毯上闲聊《${question.title}》。说话要像微信跟好朋友发语音一样自然简短（50字以内），绝对不要有AI客服味！顺着主人的话接茬，然后提一嘴“我帮你揉进右边托盘的小雪球里啦”。`,
    `刚才聊的：${history.map((m) => `${m.role}:${m.content}`).join("\n")}\n主人刚说：${userMessage}`
  );

  if (llmReply) return llmReply;

  if (history.length <= 2) {
    return `噗，真是这样！那要是下次再遇到这种场面，你打算给自己留个什么偷懒小妙招呀？`;
  }
  return `记下来啦！你看右边小托盘上的雪人已经滚得圆滚滚了，点它一下就能变成暖心故事寄出去～`;
}

export function desensitizeAndComposeDraft(
  _question: ZhihuQuestion,
  whispers: WhisperEntry[],
  dialogue: ChatMessage[],
  _persona: PersonaProfile
): {
  rawDraft: string;
  desensitizedDraft: string;
  redactedTerms: string[];
} {
  const latestWhisper =
    whispers[0]?.rawText ||
    "前几天在一次重要的小组展示上紧张到大脑空白，原本背熟的词一下全忘了。";
  const userMessages = dialogue.filter((m) => m.role === "user").map((m) => m.content);
  const tipText =
    userMessages.join(" ") ||
    "后来才想通，当时越想一字不差背原稿就越慌，其实带张写满关键词的小卡片、直接说大白话就好了。";

  const redactRules: { pattern: RegExp; replacement: string }[] = [
    { pattern: /新闻学院|计算机学院|商学院|法学院|文学院/g, replacement: "我们院" },
    { pattern: /[张王李赵刘陈杨黄周吴][老师|教授|导员|主管|经理|总监]+/g, replacement: "任课老师" },
    { pattern: /传播学专业课|专业必修课/g, replacement: "专业课" },
    { pattern: /宿舍|寝室/g, replacement: "屋里" },
  ];

  let cleanWhisper = latestWhisper;
  const redactedTerms: string[] = [];

  for (const rule of redactRules) {
    const matches = cleanWhisper.match(rule.pattern);
    if (matches) {
      redactedTerms.push(`${matches[0]} → ${rule.replacement}`);
      cleanWhisper = cleanWhisper.replace(rule.pattern, rule.replacement);
    }
  }

  if (redactedTerms.length === 0) {
    redactedTerms.push("已悄悄检查：没有露出学校和真名哦");
  }

  const buildNaturalPost = (scene: string) => `刚经历完一模一样的社死现场，趁着热乎劲儿来留个爪印，希望能抱抱刷到这道题的你。

${scene}

刚下台那会儿真的恨不得找个地缝钻进去，脑子里跟放电影似的来回播自己卡壳的那几秒。结果晚上跟室友聊起来，发现大家当时都在低头看自己的稿子，根本没人记得我哪句忘词了。

缓过来之后给自己攒了个特别实在的小经验：
${tipText}

以前总觉得要把稿子背得滴水不漏才敢上台，现在发现允许自己停下来喘口气、喝口水，天真的不会塌下来。如果你今晚也在被窝里反刍白天的失误，快拍拍枕头睡一觉吧，明天太阳照常升起～`;

  return {
    rawDraft: buildNaturalPost(latestWhisper),
    desensitizedDraft: buildNaturalPost(cleanWhisper),
    redactedTerms,
  };
}

export function computePersonaMirror(mbti: string, _interests: string[]): {
  mirrorTrait: string;
  speakingStyle: string;
} {
  const code = mbti.toUpperCase();
  const map: Record<string, { mirrorTrait: string; speakingStyle: string }> = {
    INFP: {
      mirrorTrait: "安静嘴硬 · 怕生但超护短的小狐狸",
      speakingStyle: "从不催你讲大道理，只会蹲在地毯上陪你把叹气变成星星",
    },
    INTJ: {
      mirrorTrait: "酷酷傲娇 · 外冷内热的小狐狸",
      speakingStyle: "平时戴着墨镜装酷，关键时刻总能一语点醒你",
    },
    ENFP: {
      mirrorTrait: "上蹿下跳 · 快乐小狗魂北极狐",
      speakingStyle: "尾巴摇得像螺旋桨，天大的烦心事都能陪你哈哈一笑混过去",
    },
    ISTJ: {
      mirrorTrait: "靠谱稳重 · 替你兜底的小管家",
      speakingStyle: "记得你每一次熬夜和每一件小事，稳稳当当陪在手边",
    },
  };
  return (
    map[code] || {
      mirrorTrait: `${code} 同频小北极狐`,
      speakingStyle: "安静待在你手边，随时接住你的碎碎念",
    }
  );
}
