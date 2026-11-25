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
  let bubbleQuestion = "刚经历完这件堵在心里的小事，现在回头看你最想对自己说什么？";

  if (/pre|演讲|汇报|上台|忘词|搞砸|答辩|紧张|社死/i.test(text)) {
    emotionTag = "有点委屈";
    emotionColor = "#f97316";
    structuredSummary = "上台太紧张脑子断片了，下台后还在一个人生自己的闷气。";
    corePainPoint = "越在乎就越容易发抖，真的一点都不丢人呀。";
    hiddenValue = "好多第一次上台的人也在手心冒汗，你的复盘能悄悄接住他们。";
    bubbleQuestion = "上台汇报紧张到忘词搞砸了，后来是怎么走出来的？";
  } else if (/备忘录|删|不敢发|朋友圈|熟人/i.test(text)) {
    emotionTag = "欲言又止";
    emotionColor = "#60a5fa";
    structuredSummary = "心里攒了好多真话，却在点发送前又悄悄退了回来。";
    corePainPoint = "不想被熟人围观很正常，你的感受本身就很有分量。";
    hiddenValue = "知乎上有近两万人也在聊那种写完又删掉的心情。";
    bubbleQuestion = "为什么我们总习惯把心事写进备忘录，到了发布框前又默默删掉？";
  } else if (/面试|秋招|春招|实习|offer|工作/i.test(text)) {
    emotionTag = "有点紧绷";
    emotionColor = "#38bdf8";
    structuredSummary = "面对未知的考察已经拼尽全力了，下场后先抱抱紧绷的自己。";
    corePainPoint = "一次卡壳定义不了你的本事，只是还没遇到同频的考官。";
    hiddenValue = "好多正在找工作的同龄人也在等一盏灯，你的经历能陪陪他们。";
    bubbleQuestion = "面试或汇报突然被问懵了是种什么体验？后来怎么缓过来的？";
  } else if (/考试|挂科|考研|论文|毕设|实验/i.test(text)) {
    emotionTag = "压力山大";
    emotionColor = "#f59e0b";
    structuredSummary = "对着进度条一个人死磕了这么久，真的辛苦啦。";
    corePainPoint = "慢一点也没关系，一步一步挪过去就已经很棒了。";
    hiddenValue = "同样在赶ddl和磨论文的人，最懂你此刻的叹气。";
    bubbleQuestion = "赶论文或备考快撑不住的深夜，是什么小事把你拉回来的？";
  } else if (/熬夜|凌晨|失眠|睡不着|累|孤独|一个人|租房|独居/i.test(text)) {
    emotionTag = "夜里犯困";
    emotionColor = "#8b5cf6";
    structuredSummary = "忙完安静下来突然觉得空落落的，只想找个角落待一会儿。";
    corePainPoint = "白天撑得太用力了，晚上允许自己当一只蔫掉的小狐狸吧。";
    hiddenValue = "这份深夜的小切片很温柔，好多夜猫子刷到都会想给你点个赞。";
    bubbleQuestion = "熬到深夜还舍不得睡的时候，都有哪些只有自己懂的瞬间？";
  }

  const llmReply = await callOptionalLLM(
    `你是一只住在主人冰屋里的小北极狐「小看山」（主人性格：${persona.mbti}）。说话要完全没有AI味，不能说教！根据主人刚倾诉的经历，提炼一个像知乎高共鸣提问一样的疑问句（必须以问号结尾，16到26个字，紧扣主人的具体经历）。返回JSON：{"emotionTag":"4字内心情小贴纸","structuredSummary":"30字内像小动物记日记一样的暖心话","hiddenValue":"30字内轻轻提一句也有人在聊这个","bubbleQuestion":"紧扣主人经历的话题疑问句？"}`,
    text
  );

  if (llmReply) {
    try {
      const parsed = JSON.parse(llmReply.replace(/```json|```/g, "").trim());
      if (parsed.emotionTag) emotionTag = parsed.emotionTag;
      if (parsed.structuredSummary) structuredSummary = parsed.structuredSummary;
      if (parsed.hiddenValue) hiddenValue = parsed.hiddenValue;
      if (parsed.bubbleQuestion) bubbleQuestion = parsed.bubbleQuestion;
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
    bubbleQuestion,
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
    // 外交家 NF
    INFP: {
      mirrorTrait: "INFP 调停者 · 慢热护短的共情小狐狸",
      speakingStyle: "从不催你讲大道理，只会蹲在地毯上陪你把叹气变成小雪球",
    },
    INFJ: {
      mirrorTrait: "INFJ 提倡者 · 一眼看穿心事的温柔小狐狸",
      speakingStyle: "哪怕你只说半句话，也懂你没说出口的后半句，安静替你守着秘密",
    },
    ENFP: {
      mirrorTrait: "ENFP 竞选者 · 快乐小狗魂的元气北极狐",
      speakingStyle: "尾巴摇得像小螺旋桨，天大的烦心事都能陪你脑洞大开混过去",
    },
    ENFJ: {
      mirrorTrait: "ENFJ 主人公 · 随时给你撑腰的暖心小队长",
      speakingStyle: "总能第一时间接住你的情绪，把你身上的闪光点一个个夸给你听",
    },
    // 分析家 NT
    INTJ: {
      mirrorTrait: "INTJ 建筑师 · 外冷内热的酷盖小狐狸",
      speakingStyle: "平时推着黑框眼镜装深沉，关键时刻总能冷静帮你理清一团乱麻",
    },
    INTP: {
      mirrorTrait: "INTP 逻辑学家 · 陪你半夜胡思乱想的猫系狐狸",
      speakingStyle: "最喜欢听你聊奇奇怪怪的脑洞，凌晨两点还在认真陪你推演为什么",
    },
    ENTJ: {
      mirrorTrait: "ENTJ 指挥官 · 嘴硬心软的靠谱大女主/男主狐",
      speakingStyle: "嘴上嫌弃你内耗，爪子早就替你把下一步的退路铺得明明白白",
    },
    ENTP: {
      mirrorTrait: "ENTP 辩论家 · 鬼点子超多的毒舌损友狐",
      speakingStyle: "专治各种钻牛角尖，三言两语就能把你的社死现场变成脱口秀段子",
    },
    // 守护者 SJ
    ISTJ: {
      mirrorTrait: "ISTJ 物流师 · 事事有回音的稳重小管家",
      speakingStyle: "记得你每一次熬夜和每一件小事，稳稳当当守在冰屋桌角替你兜底",
    },
    ISFJ: {
      mirrorTrait: "ISFJ 守卫者 · 把你照顾得妥帖周到的小棉袄",
      speakingStyle: "总在细节里藏着温柔，天冷提醒加衣，心累了给你递上一杯热可可",
    },
    ESTJ: {
      mirrorTrait: "ESTJ 总经理 · 行动力拉满的护短小班长",
      speakingStyle: "不让你一个人在被窝里瞎纠结，陪你把大麻烦拆成小事一件件搞定",
    },
    ESFJ: {
      mirrorTrait: "ESFJ 执政官 · 永远站在你这边的小太阳",
      speakingStyle: "最见不得你受委屈，你一皱眉头就立刻端着小鱼干跑过来哄你",
    },
    // 探险家 SP
    ISFP: {
      mirrorTrait: "ISFP 探险家 · 浪漫随性的审美家小狐狸",
      speakingStyle: "不爱讲条条框框，喜欢拉着你一起看窗外飘雪、收集亮晶晶的小废品",
    },
    ISTP: {
      mirrorTrait: "ISTP 鉴赏家 · 话不多但超淡定的松弛感大师",
      speakingStyle: "天塌下来也先淡定舔舔爪子，光是待在他旁边焦虑就会自动降一半",
    },
    ESTP: {
      mirrorTrait: "ESTP 企业家 · 带你冲出内耗的潇洒行动派",
      speakingStyle: "信奉先干了再说，再尴尬的场面在他眼里都只是一场好玩的冒险",
    },
    ESFP: {
      mirrorTrait: "ESFP 表演者 · 把平淡日子过成烟花的开心果",
      speakingStyle: "浑身都是快乐细胞，随时随地给你表演出一套翻跟头逗你笑出声",
    },
  };
  return (
    map[code] || {
      mirrorTrait: `${code} · 同频陪伴小北极狐`,
      speakingStyle: "安静待在你手边，随时接住你的碎碎念",
    }
  );
}
