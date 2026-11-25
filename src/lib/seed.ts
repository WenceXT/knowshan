import { AccessoryItem, HoardedItem, KnowShanStore, ZhihuQuestion } from "@/types/knowshan";

export const ACCESSORIES: AccessoryItem[] = [
  {
    id: "thick_glasses",
    name: "经典黑框眼镜",
    icon: "glasses",
    costExp: 0,
    description: "呆萌一体连眉粗框眼镜，戴上立刻有知乎那味儿",
    slot: "eyes",
  },
  {
    id: "zhihu_scarf",
    name: "冰川蓝小围巾",
    icon: "scarf",
    costExp: 0,
    description: "北极冰屋标配软糯针织围巾，护住怕冷的小脖子",
    slot: "neck",
  },
  {
    id: "camp_beanie",
    name: "暖冬小毛线帽",
    icon: "beanie",
    costExp: 0,
    description: "滚金边针织毛球帽，熬夜不怕头顶凉飕飕",
    slot: "head",
  },
  {
    id: "codfish_plush",
    name: "小银鳕鱼零嘴",
    icon: "fish",
    costExp: 120,
    description: "出门逛雪原叼回来的最爱零食",
    slot: "hand",
  },
  {
    id: "ear_muffs",
    name: "粉绒小耳罩",
    icon: "muffs",
    costExp: 200,
    description: "把外面的嘈杂都挡在冰屋外面，安静待一会儿",
    slot: "head",
  },
];

export const ALL_HOARD_TREASURES: HoardedItem[] = [
  // Batch 1 (Initial sparkling items in room)
  {
    id: "h-1",
    itemName: "展平的小手卡",
    emoji: "card",
    postTitle: "为什么你以为的当众出糗，台下的人五分钟就忘了？",
    author: "简里里 · 2.4 万赞同",
    upvotes: "2.4 万赞同",
    excerpt:
      "人们总是把聚光灯打在自己身上。你在台上卡壳的两秒钟，台下同学大概率在想中午吃什么，真没人盯着你的失误记仇。",
    reason: "昨晚听你说汇报忘词，看山特意从雪原叼回来的",
    zhihuUrl:
      "https://www.zhihu.com/search?type=content&q=%E8%81%9A%E5%85%89%E7%81%AF%E6%95%88%E5%BA%94+%E5%BD%93%E4%BC%97%E5%87%BA%E7%B3%97",
  },
  {
    id: "h-2",
    itemName: "发光小银鳕鱼",
    emoji: "fish",
    postTitle: "内向的人怎么用「说人话」的方式稳稳拿捏小组汇报？",
    author: "苏菲 · 8,920 赞同",
    upvotes: "8,920 赞同",
    excerpt:
      "不用硬装脱口秀演员。每页 PPT 底下留一句像跟朋友聊天一样的过渡句，紧张时照着念也超自然。",
    reason: "看你收藏夹里攒了好几篇演讲帖，顺爪捡回来的",
    zhihuUrl:
      "https://www.zhihu.com/search?type=content&q=%E5%86%85%E5%90%91%E8%80%85%E5%A6%82%E4%BD%95%E5%81%9A%E5%A5%BDPresentation",
  },
  {
    id: "h-3",
    itemName: "极光许愿星瓶",
    emoji: "star_jar",
    postTitle: "半夜躺在床上反复回想白天的失误，怎么按暂停键？",
    author: "栖迟 · 1.5 万赞同",
    upvotes: "1.5 万赞同",
    excerpt:
      "凌晨十二点半的大脑只是累了，不是你不好。把心事团成雪球推出去，睡醒太阳出来就轻一半了。",
    reason: "留给半夜还在亮着屏幕发呆的你",
    zhihuUrl:
      "https://www.zhihu.com/search?type=content&q=%E6%B7%B1%E5%A4%9C%E6%83%85%E7%BB%AA%E5%8F%8D%E5%88%8D+%E7%89%A9%E7%90%86%E6%89%93%E6%96%AD",
  },
  // Batch 2 (Refreshed on clicking 出门)
  {
    id: "h-4",
    itemName: "冒热气的可可杯",
    emoji: "cocoa",
    postTitle: "独居或一个人待着的时候，有哪些低成本瞬间幸福的小事？",
    author: "温酒 · 3.1 万赞同",
    upvotes: "3.1 万赞同",
    excerpt:
      "洗完热水澡钻进刚晒过的被窝，或者给桌角的小摆件换顶新帽子——把注意力收回到手边五平米，焦虑就追不上你。",
    reason: "看山刚去热榜雪地转了一圈，给你带回来暖手的",
    zhihuUrl:
      "https://www.zhihu.com/search?type=content&q=%E7%8B%AC%E5%A4%84%E4%BD%8E%E6%88%90%E6%9C%AC%E5%B9%B8%E7%A6%8F%E7%9A%84%E5%B0%8F%E4%BA%8B",
  },
  {
    id: "h-5",
    itemName: "折成纸飞机的备忘录",
    emoji: "plane",
    postTitle: "为什么我们总觉得自己的经历很普通，不配写出来分享？",
    author: "林夏 · 1.2 万赞同",
    upvotes: "1.2 万赞同",
    excerpt:
      "真正帮到别人的往往不是大神俯视的完美攻略，而是一个刚踩完坑的普通人回头喊的一句『别怕，这儿有块石头』。",
    reason: "在雪原路过一片树洞时捡到的纸飞机",
    zhihuUrl:
      "https://www.zhihu.com/search?type=content&q=%E6%99%AE%E9%80%9A%E4%BA%BA%E7%9A%84%E7%BB%8F%E5%8E%86%E5%80%BC%E5%BE%97%E5%88%86%E4%BA%AB%E5%90%97",
  },
  {
    id: "h-6",
    itemName: "听海小贝壳",
    emoji: "shell",
    postTitle: "有哪些瞬间让你突然和「不够完美的自己」和解了？",
    author: "阿鲸 · 1.9 万赞同",
    upvotes: "1.9 万赞同",
    excerpt:
      "看到很敬重的前辈上台前也在偷偷深呼吸搓手心，那一刻突然明白，勇敢不是不发抖，是带着发抖把话说完。",
    reason: "看山在冰海岸边趴了半天挑出来的亮晶晶贝壳",
    zhihuUrl:
      "https://www.zhihu.com/search?type=content&q=%E5%92%8C%E4%B8%8D%E5%AE%8C%E7%BE%8E%E7%9A%84%E8%87%AA%E5%B7%B1%E5%92%8C%E8%A7%A3",
  },
  // Batch 3
  {
    id: "h-7",
    itemName: "金色小铃铛",
    emoji: "bell",
    postTitle: "第一次在知乎收到陌生人认真的感谢评论是什么体验？",
    author: "小透明答主 · 9,400 赞同",
    upvotes: "9,400 赞同",
    excerpt:
      "原本只是半夜随手记下自己走弯路的教训，没想到半年后还有人留言说因为这篇回答熬过了最难的一周。",
    reason: "雪地里叮当作响的金色小铃铛，替你攒着好运",
    zhihuUrl:
      "https://www.zhihu.com/search?type=content&q=%E7%AC%AC%E4%B8%80%E6%AC%A1%E5%9C%A8%E7%9F%A5%E4%B9%8E%E6%94%B6%E5%88%B0%E6%84%9F%E8%B0%A2",
  },
  {
    id: "h-8",
    itemName: "北极冰晶玫瑰",
    emoji: "crystal",
    postTitle: "敏感内耗的人，如何保护好自己的能量场？",
    author: "沈知微 · 2.7 万赞同",
    upvotes: "2.7 万赞同",
    excerpt:
      "敏感其实是很珍贵的天赋，你只是感受力比别人细腻。给情绪找一个安全的小出口，它就会变成你的创作力。",
    reason: "刚从极光底下挖出来的透明冰晶",
    zhihuUrl:
      "https://www.zhihu.com/search?type=content&q=%E6%95%8F%E6%84%9F%E5%86%85%E8%80%97%E7%9A%84%E4%BA%BA%E5%A6%82%E4%BD%95%E4%BF%9D%E6%8A%A4%E8%83%BD%E9%87%8F",
  },
  {
    id: "h-9",
    itemName: "暖黄小橡果",
    emoji: "acorn",
    postTitle: "二十岁出头感到迷茫慢半拍，真的要紧吗？",
    author: "北极狐来信 · 1.6 万赞同",
    upvotes: "1.6 万赞同",
    excerpt:
      "每个人都有自己的时区。有人二十二岁开花，有人二十八岁才发芽，慢慢攒着自己的小橡果就很好。",
    reason: "看山藏在沙发缝里准备送给你的小礼物",
    zhihuUrl:
      "https://www.zhihu.com/search?type=content&q=%E4%BA%8C%E5%8D%81%E5%B2%81%E8%BF%B7%E8%8C%AB%E6%85%A2%E5%8D%8A%E6%8B%8D",
  },
];

export const QUESTION_POOL: ZhihuQuestion[] = [
  {
    id: "q-pre-nervous",
    title: "第一次上台演讲紧张到忘词搞砸了，是怎样的体验？后来怎么走出来的？",
    bubblePrompt: "上台汇报紧张到忘词搞砸了，后来是怎么走出来的？",
    topic: "1.4 万人在聊",
    followers: 14820,
    views: "892 万浏览",
    matchScore: 98,
    matchReason: "昨晚你跟我念叨上台忘词的事，刚好外面有好多人也在问这个",
    zhidaInsight:
      "台下的人五分钟就忘了谁卡过壳，大家最想看的是你下台后怎么抱住那个发抖的自己。",
    zhihuSearchUrl:
      "https://www.zhihu.com/search?type=content&q=%E4%B8%8A%E5%8F%B0%E6%BC%94%E8%AE%B2%E7%B4%A7%E5%BC%A0%E5%BF%98%E8%AF%8D%E6%98%AF%E6%80%8E%E6%A0%B7%E7%9A%84%E4%BD%93%E9%AA%8C",
    keywords: ["pre", "演讲", "汇报", "上台", "紧张", "忘词", "搞砸", "答辩", "社死", "发抖"],
  },
  {
    id: "q-late-night-solitude",
    title: "有哪些只有长期独处或熬夜的人才会懂的「深夜瞬间」？",
    bubblePrompt: "熬到深夜还舍不得睡的时候，都有哪些只有自己懂的瞬间？",
    topic: "2.6 万人在聊",
    followers: 26390,
    views: "1,840 万浏览",
    matchScore: 93,
    matchReason: "每次夜里十二点半你还醒着，我都团在爪印毯上陪你发呆",
    zhidaInsight:
      "凌晨关掉台灯后的那口气，写出来总会收到很多陌生人的「晚安」。",
    zhihuSearchUrl:
      "https://www.zhihu.com/search?type=content&q=%E7%8B%AC%E5%A4%84%E6%88%96%E7%86%AC%E5%A4%9C%E7%9A%84%E6%B7%B1%E5%A4%9C%E7%9E%AC%E9%97%B4",
    keywords: ["熬夜", "凌晨", "睡不着", "失眠", "孤独", "独居", "一个人", "累", "内耗", "焦虑"],
  },
  {
    id: "q-silent-reader",
    title: "为什么现在很多人习惯把心事写进备忘录，却不敢发出来？",
    bubblePrompt: "为什么我们总习惯把心事写进备忘录，到了发布框前又默默删掉？",
    topic: "1.9 万人在聊",
    followers: 19450,
    views: "1,120 万浏览",
    matchScore: 91,
    matchReason: "你攒了 186 条收藏却还没发过声，你的碎碎念其实很温柔呀",
    zhidaInsight:
      "怕被熟人认出来没关系，我帮你把学校和名字悄悄擦掉再寄出去。",
    zhihuSearchUrl:
      "https://www.zhihu.com/search?type=content&q=%E6%8A%8A%E6%83%B3%E6%B3%95%E5%86%99%E5%9C%A8%E5%A4%87%E5%BF%98%E5%BD%95%E4%B8%8D%E6%95%A2%E5%8F%91",
    keywords: ["备忘录", "不敢发", "朋友圈", "社恐", "表达", "害怕", "熟人", "完美主义", "删"],
  },
];

export function createInitialStore(): KnowShanStore {
  return {
    persona: {
      nickname: "蟹味",
      mbti: "INFP",
      roleTag: "sirius",
      zhihuInterests: ["大学日常", "上台表达", "独处充电", "心理学"],
      oauthConnected: true,
      zhihuStats: {
        browsedCount: 1428,
        savedCount: 186,
        publishedCount: 0,
        silentDays: 12,
      },
      mirrorTrait: "INFP 调停者 · 慢热护短的共情小狐狸",
      speakingStyle: "从不催你讲大道理，只会蹲在地毯上陪你把叹气变成小雪球",
    },
    pet: {
      mood: "calm",
      energy: 86,
      hasDarkCircles: false,
      exp: 560,
      level: 5,
      snowballProgress: 20,
      unlockedItems: ["thick_glasses", "zhihu_scarf", "camp_beanie"],
      equippedItems: [],
      lastSyncAt: "00:32 · 小窝陪伴中",
      statusMessage: "地上闪闪发光的是我刚给你捡回来的小东西，点开看看吧",
    },
    whispers: [
      {
        id: "w-demo-1",
        createdAt: "00:18",
        source: "web_diary",
        rawText:
          "今天下午在新闻学院张老师的传播学专业课做小组 Pre 彻底搞砸了……看到台下几十双眼睛盯着我，脑子一下全白了，准备好的词忘得一干二净，声音都在抖。回到宿舍还是好难受。",
        emotionTag: "有点委屈",
        emotionColor: "#3b82f6",
        structuredSummary: "上台太紧张脑子断片了，下台后一直在心里倒带责怪自己。",
        corePainPoint: "其实准备得很认真，只是怕被人记住出糗的样子。",
        hiddenValue: "很多第一次上台的人也在发抖，你的小复盘能接住他们。",
        bubbleQuestion: "上台汇报紧张到忘词搞砸了，后来是怎么走出来的？",
        matchedQuestionIds: ["q-pre-nervous", "q-silent-reader"],
      },
    ],
    questions: QUESTION_POOL,
    activeQuestionId: "q-pre-nervous",
    dialogues: {
      "q-pre-nervous": [
        {
          id: "m-1",
          role: "kanshan",
          content:
            "昨晚你跟我叹气说上台忘词的时候，我都记下来啦。刚好外面有 1.4 万人也在聊这个——如果能递给昨天台上的自己一样小东西，你最想递什么？",
          createdAt: "00:25",
        },
        {
          id: "m-2",
          role: "user",
          content:
            "递一张只写三个过渡大字的小手卡吧，越想背原稿越慌，说大白话就好了。",
          createdAt: "00:28",
        },
        {
          id: "m-3",
          role: "kanshan",
          content:
            "太实在啦！点一下右边的「堆雪」，我就把昨晚的话和这句妙招团成三颗小雪球，悄悄擦掉学院和老师名字寄出去～",
          createdAt: "00:28",
        },
      ],
    },
    hoardedItems: ALL_HOARD_TREASURES.slice(0, 3),
    publishedAnswers: [],
  };
}
