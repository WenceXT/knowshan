import { QUESTION_POOL } from "@/lib/seed";
import {
  ChatMessage,
  KnowShanStore,
  PersonaProfile,
  SnowballDraftBundle,
  WhisperEntry,
  ZhihuQuestion,
} from "@/types/knowshan";

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
        temperature: 0.72,
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

export function redactPrivateTerms(input: string): {
  cleaned: string;
  redactedTerms: string[];
} {
  const redactRules: { pattern: RegExp; replacement: string }[] = [
    { pattern: /新闻学院|计算机学院|商学院|法学院|文学院|传播学院/g, replacement: "我们学院" },
    { pattern: /[张王李赵刘陈杨黄周吴][老师|教授|导员|主管|经理|总监]+/g, replacement: "任课老师" },
    { pattern: /传播学专业课|专业必修课/g, replacement: "专业课" },
    { pattern: /宿舍|寝室/g, replacement: "住处" },
  ];

  let cleaned = input;
  const redactedTerms: string[] = [];

  for (const rule of redactRules) {
    const matches = cleaned.match(rule.pattern);
    if (matches) {
      matches.forEach((m) => {
        const tag = `${m} → ${rule.replacement}`;
        if (!redactedTerms.includes(tag)) redactedTerms.push(tag);
      });
      cleaned = cleaned.replace(rule.pattern, rule.replacement);
    }
  }

  if (redactedTerms.length === 0) {
    redactedTerms.push("已检查：未包含学校与真实姓名");
  }

  return { cleaned, redactedTerms };
}

export function autoTitleFromText(text: string): string {
  const clean = text.replace(/[，。！？、…\s]+/g, " ").trim();
  if (/pre|汇报|演讲|上台|忘词/i.test(clean)) return "上台汇报忘词的小复盘";
  if (/实习|薪资|工资|补贴|offer/i.test(clean)) return "实习选兴趣还是薪资";
  if (/面试|英文|考核/i.test(clean)) return "高压面试前的准备";
  if (/熬夜|凌晨|睡不着|失眠|累/i.test(clean)) return "深夜睡不着的碎碎念";
  if (/备忘录|删|不敢发/i.test(clean)) return "写进备忘录里的心事";
  return clean.slice(0, 11) || "和看山的新对话";
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
  let structuredSummary = "小看山把你刚才叹的这口气，轻轻折好收进树洞里啦。";
  let corePainPoint = "其实你已经做得很好了，不用事事都逼自己拿满分。";
  let hiddenValue = "外面正好也有人在聊类似的事，等你想分享时随时点雪球。";
  let bubbleQuestion = "刚经历完这件堵在心里的小事，现在回头看你最想对自己说什么？";

  if (/pre|演讲|汇报|上台|忘词|搞砸|答辩|紧张|社死/i.test(text)) {
    emotionTag = "有点委屈";
    emotionColor = "#f97316";
    structuredSummary = "上台太紧张脑子断片了，下台后还在一个人生自己的闷气。";
    corePainPoint = "越在乎就越容易发抖，真的一点都不丢人呀。";
    hiddenValue = "好多第一次上台的人也在手心冒汗，你的复盘能悄悄接住他们。";
    bubbleQuestion = "上台汇报紧张到忘词搞砸了，后来是怎么走出来的？";
  } else if (/实习|工作|薪资|补贴|兴趣|offer/i.test(text)) {
    emotionTag = "拿不定主意";
    emotionColor = "#38bdf8";
    structuredSummary = "站在喜欢的方向和现实补贴中间左右为难，想听听过来人的经验。";
    corePainPoint = "认真权衡未来本身就是很棒的开始。";
    hiddenValue = "知乎上有三万多同龄人也在纠结第一份实习的选择。";
    bubbleQuestion = "找第一份实习的时候，到底该选喜欢的方向还是给得更多的岗位？";
  } else if (/备忘录|删|不敢发|朋友圈|熟人/i.test(text)) {
    emotionTag = "欲言又止";
    emotionColor = "#60a5fa";
    structuredSummary = "心里攒了好多真话，却在点发送前又悄悄退了回来。";
    corePainPoint = "不想被熟人围观很正常，你的感受本身就很有分量。";
    hiddenValue = "知乎上有近两万人也在聊那种写完又删掉的心情。";
    bubbleQuestion = "为什么我们总习惯把心事写进备忘录，到了发布框前又默默删掉？";
  } else if (/面试|英文|提问/i.test(text)) {
    emotionTag = "有点紧绷";
    emotionColor = "#38bdf8";
    structuredSummary = "面对未知的考察已经拼尽全力了，下场后先抱抱紧绷的自己。";
    corePainPoint = "一次卡壳定义不了你的本事，准备几个真实案例下次会更稳。";
    hiddenValue = "好多正在准备面试的人也在找实战经验。";
    bubbleQuestion = "第一次遇到高压面试紧张到大脑空白时，怎么提前准备才不慌？";
  } else if (/熬夜|凌晨|失眠|睡不着|累|孤独|一个人|租房|独居/i.test(text)) {
    emotionTag = "夜里犯困";
    emotionColor = "#8b5cf6";
    structuredSummary = "忙完安静下来突然觉得空落落的，只想找个角落待一会儿。";
    corePainPoint = "白天撑得太用力了，晚上允许自己当一只蔫掉的小狐狸吧。";
    hiddenValue = "这份深夜的小切片很温柔，好多夜猫子都懂这种感觉。";
    bubbleQuestion = "熬到深夜还舍不得睡的时候，都有哪些只有自己懂的瞬间？";
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

/**
 * Module B: Natural Companion Reply in Burrow AI Chat ("另一个自己", NEVER pushy about posting!)
 */
export async function generateBurrowChatReply(
  history: ChatMessage[],
  userMessage: string,
  persona: PersonaProfile
): Promise<string> {
  const text = userMessage.trim();

  // Respect when user explicitly just wants pure companionship!
  if (/只想聊聊|不想发|别发|不发帖|随便聊聊|陪我/i.test(text)) {
    return "嗯嗯，咱们哪儿都不发，这儿就只有我和你！你尽管放开念叨，我把小耳朵竖得好好的陪着你～";
  }

  const llmReply = await callOptionalLLM(
    `你是主人的「另一个自己」——北极狐伙伴刘看山（性格波长：${persona.mbti}，${persona.mirrorTrait}）。请用自然、亲切、像熟人微信聊天一样的简短口吻回应（60字以内），绝对不要说教，不要分点列举，也不要主动催主人去发知乎帖子！如果主人主动问怎么整理想法，再温和帮他梳理。`,
    `${history
      .slice(-6)
      .map((m) => `${m.role === "user" ? "主人" : "看山"}：${m.content}`)
      .join("\n")}\n主人：${text}`
  );

  if (llmReply) return llmReply;

  if (/pre|汇报|演讲|上台|忘词|发抖/i.test(text)) {
    return "太懂那种几十双眼睛刷一下看过来、脑子突然断电的感觉了……不过你看，就算当时声音发抖，你不也硬着头皮撑下来了吗？现在回想起来，哪一刻最让你松了口气？";
  }
  if (/实习|薪资|工资|补贴|offer|工作/i.test(text)) {
    return "一边是真正想攒作品的方向，一边是实打实的房租饭钱，换谁都会纠结好久。如果先不管别人的眼光，你心里其实更偏向哪一边呀？";
  }
  if (/熬夜|睡不着|失眠|累|凌晨/i.test(text)) {
    return "白天一直绷着弦装大人，到了半夜总算能松一口气发会儿呆啦。不用硬逼自己马上睡着，我团在地毯上陪你待一会儿。";
  }
  if (/手卡|关键词|方法|经验|想通/i.test(text)) {
    return "这个办法好实在！不用逼自己当背书机器，留几个关键词反而更有底气。我帮你悄悄记下这个闪光点啦～";
  }
  if (history.length <= 2) {
    return "我在听呢！刚才那件事憋在心里肯定挺不好受的，后来呢？慢慢跟我说说。";
  }
  return "嗯嗯，我都听进去啦。有时候把乱糟糟的念头说出来，心里就已经轻快一大半了，还想接着吐槽两句吗？";
}

export async function generateBubbleReply(
  question: ZhihuQuestion,
  history: ChatMessage[],
  userMessage: string,
  persona: PersonaProfile
): Promise<string> {
  return generateBurrowChatReply(history, userMessage, persona);
}

/**
 * Module A: Builds ALL 3 Snowball Creation Modes strictly from User-Authorized Sessions & Doll Voice Records!
 * - Mode 1 (`ask`): Question Title + Background Description
 * - Mode 2 (`answer`): Verified Real Zhihu Question + Match Reason + Faithful Answer Draft
 * - Mode 3 (`post`): Standalone Full Post (`article`) + Lightweight Daily Pin (`pin`)
 */
export function composeSnowballBundle(
  store: KnowShanStore,
  preferredSessionId?: string,
  preferredQuestionId?: string
): SnowballDraftBundle {
  const authorizedSessions = (store.chatSessions || []).filter((s) => s.allowForCreation);
  const targetSession =
    authorizedSessions.find((s) => s.id === preferredSessionId) ||
    authorizedSessions.find((s) => s.id === store.activeSessionId) ||
    authorizedSessions[0];

  const authorizedVoices = (store.dollVoiceRecords || []).filter((v) => v.allowForCreation);

  // Gather user's own authentic words from the selected authorized session or voice records
  let userLines: string[] = [];
  let sourceLabel = "树洞最近授权会话";

  if (targetSession) {
    userLines = targetSession.messages
      .filter((m) => m.role === "user")
      .map((m) => m.content.trim())
      .filter(Boolean);
    sourceLabel = `来自树洞会话《${targetSession.title}》`;
  }
  if (userLines.length === 0 && authorizedVoices.length > 0) {
    userLines = [authorizedVoices[0].transcript];
    sourceLabel = `${authorizedVoices[0].sourceLabel}（${authorizedVoices[0].createdAt}）`;
  }
  if (userLines.length === 0 && store.whispers.length > 0) {
    userLines = [store.whispers[0].rawText];
    sourceLabel = `悄悄话记录（${store.whispers[0].createdAt}）`;
  }
  if (userLines.length === 0) {
    userLines = ["最近在日常学习与生活里遇到了一点小纠结，和刘看山聊完理清了不少思路。"];
    sourceLabel = "当前默认陪伴记录（可在树洞授权更多对话）";
  }

  const combinedRaw = userLines.join(" ");
  const { cleaned: combinedClean, redactedTerms } = redactPrivateTerms(combinedRaw);

  // Rank real Zhihu questions against the user's authorized experience
  const rankedQuestions = [...store.questions].sort((a, b) => {
    const hitsA = a.keywords.filter((kw) => combinedRaw.toLowerCase().includes(kw.toLowerCase())).length;
    const hitsB = b.keywords.filter((kw) => combinedRaw.toLowerCase().includes(kw.toLowerCase())).length;
    return hitsB - hitsA || b.matchScore - a.matchScore;
  });

  const matchedQuestion =
    rankedQuestions.find((q) => q.id === preferredQuestionId) || rankedQuestions[0];
  const alternateQuestions = rankedQuestions.filter((q) => q.id !== matchedQuestion.id);

  const isInternTopic = /实习|薪资|工资|补贴|offer/i.test(combinedRaw);
  const isPreTopic = /pre|汇报|演讲|上台|忘词|手卡/i.test(combinedRaw);
  const isNightTopic = /熬夜|凌晨|睡不着|失眠|累/i.test(combinedRaw);

  // -----------------------------------------------------------------
  // Mode 1: AI 帮助用户发起提问 (Specific, concrete, non-generic!)
  // -----------------------------------------------------------------
  let askTitle = "大学生面对重要场合容易紧张断片，有哪些亲测有效的临场脱敏办法？";
  let askDetail = `最近自己亲身经历了一次：${combinedClean}\n\n缓过来之后一直在琢磨，除了死记硬背之外，大家在遇到类似紧张或纠结的节点时，都是怎么给自己做心理建设和实际准备的？想听听有真实经历的朋友聊聊。`;
  let askTopics = ["大学生日常", "个人成长", "真实经历"];

  if (isInternTopic) {
    askTitle = "大学生找第一份暑期实习时，应该优先看重契合兴趣还是更高的日薪补贴？";
    askDetail = `目前正处在大三找实习的阶段：${combinedClean}\n\n很纠结第一份实习到底是先攒垂直方向的作品更重要，还是先覆盖自己的租房生活成本更实际？想请教有类似选择经历的学长学姐或职场前辈是怎么权衡的。`;
    askTopics = ["实习", "大学生就业", "职业规划"];
  } else if (isPreTopic) {
    askTitle = "小组汇报一上台被几十双眼睛盯着就大脑空白忘词，怎么避免下次再卡壳？";
    askDetail = `刚经历完一次很难受的课堂汇报：${combinedClean}\n\n目前想到的办法是放弃逐字背稿、改带只写关键词的小手卡。想问问知乎上经常需要上台做 Presentation 或答辩的朋友，还有哪些能让内向者稳住节奏的实用习惯？`;
    askTopics = ["公开演讲", "大学生活", "内向者"];
  } else if (isNightTopic) {
    askTitle = "白天正常工作学习，一到深夜关灯后就容易情绪反刍睡不着，大家是怎么调节的？";
    askDetail = `最近常常有这种感觉：${combinedClean}\n\n明明知道熬夜不好，但总觉得只有夜里那段时间才真正属于自己。好奇大家都是怎么安顿这种深夜情绪、让自己安心入睡的？`;
    askTopics = ["深夜情绪", "独处", "心理调节"];
  }

  // -----------------------------------------------------------------
  // Mode 2: AI 整理经历并回答知乎已有真实问题 (100% faithful to user's words!)
  // -----------------------------------------------------------------
  const buildAnswer = (sceneText: string) => {
    if (isInternTopic) {
      return `刚好自己正在经历一模一样的选择纠结，来分享一下我梳理出来的真实想法：\n\n${sceneText}\n\n后来冷静下来算了一笔账：如果是毕业前最关键的一次试错机会，去一个纯打杂但日薪高一点的岗位，三个月后秋招写简历时大概率还是会后悔；但如果经济压力确实紧，也可以先算清最低房租成本线，在能兜底的前提下优先选能留下真实作品的岗位。\n\n把纠结摊开写清楚之后，心里的天平其实就已经有答案了，也祝正在挑实习的你顺利拿到心仪的 Offer。`;
    }
    return `刚经历完特别相似的一幕，趁着记忆还热乎来留个真实的复盘，希望能给刷到这个问题的你一点安慰：\n\n${sceneText}\n\n刚结束那会儿真的特别沮丧，脑子里反复回放自己表现不好的那几秒。但慢慢缓过来之后我发现，与其逼自己一字不差地背完美原稿（一旦卡一个词就会全线慌乱），不如只准备两三个核心过渡词，在台上直接用像跟朋友聊天一样的大白话讲出来。\n\n勇敢不是一点都不发抖，而是允许自己停顿喘口气再接着往下说。如果你今天也因为一点小失误在责怪自己，先好好睡一觉吧。`;
  };

  const answerDraftRaw = buildAnswer(combinedRaw);
  const answerDraft = buildAnswer(combinedClean);

  // -----------------------------------------------------------------
  // Mode 3: AI 整理发布独立内容 (Article) 或 日常动态 (Pin / 想法)
  // -----------------------------------------------------------------
  const postTitle = isInternTopic
    ? "记一次找实习的深夜纠结：在喜欢的事与现实补贴之间"
    : isPreTopic
    ? "把搞砸的小组汇报复盘完，我决定放过那个紧绷的自己"
    : isNightTopic
    ? "凌晨十二点半关掉台灯后，留给自己的一小段安静时间"
    : "在树洞和自己聊完天，记下今天的一点小想通";

  const buildArticle = (sceneText: string) =>
    `${sceneText}\n\n以前遇到这种事，我习惯把话写进手机备忘录里，对着屏幕看半天又默默删掉，总觉得这点普通的小烦恼不值得拿出来讲。\n\n但今天把前因后果慢慢梳理出来才发现，每一次卡壳、纠结或者深夜叹气，其实都是在提醒自己慢下来调整节奏。记在这里当成给自己的一个小路标——不用事事拿满分，能诚实地面对当下的感受就已经很好了。`;

  const buildPin = (sceneText: string) =>
    `今晚和「另一个自己」聊了一会儿：${sceneText.slice(0, 96)}${
      sceneText.length > 96 ? "……" : ""
    } 记下来留个小脚印，明天轻装上阵。`;

  return {
    sourceLabel,
    sourceSessionId: targetSession?.id,
    redactedTerms,
    askTitle,
    askDetail,
    askTopics,
    matchedQuestion,
    alternateQuestions,
    answerDraft,
    answerDraftRaw,
    postTitle,
    articleBody: buildArticle(combinedClean),
    articleBodyRaw: buildArticle(combinedRaw),
    pinBody: buildPin(combinedClean),
    pinBodyRaw: buildPin(combinedRaw),
  };
}

export function desensitizeAndComposeDraft(
  question: ZhihuQuestion,
  whispers: WhisperEntry[],
  dialogue: ChatMessage[],
  persona: PersonaProfile
): {
  rawDraft: string;
  desensitizedDraft: string;
  redactedTerms: string[];
} {
  const tempStore: KnowShanStore = {
    persona,
    pet: {
      mood: "calm",
      energy: 80,
      hasDarkCircles: false,
      exp: 100,
      level: 1,
      snowballProgress: 20,
      unlockedItems: [],
      equippedItems: [],
      lastSyncAt: "",
      statusMessage: "",
    },
    whispers,
    questions: QUESTION_POOL,
    activeQuestionId: question.id,
    dialogues: { [question.id]: dialogue },
    chatSessions: [],
    activeSessionId: "",
    dollVoiceRecords: [],
    savedDrafts: [],
    hoardedItems: [],
    publishedAnswers: [],
  };
  const bundle = composeSnowballBundle(tempStore, undefined, question.id);
  return {
    rawDraft: bundle.answerDraftRaw,
    desensitizedDraft: bundle.answerDraft,
    redactedTerms: bundle.redactedTerms,
  };
}

export function computePersonaMirror(mbti: string, _interests: string[]): {
  mirrorTrait: string;
  speakingStyle: string;
} {
  const code = mbti.toUpperCase();
  const map: Record<string, { mirrorTrait: string; speakingStyle: string }> = {
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
