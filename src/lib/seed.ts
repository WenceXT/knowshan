import { AccessoryItem, KnowShanStore, ZhihuQuestion } from "@/types/knowshan";

export const ACCESSORIES: AccessoryItem[] = [
  {
    id: "thick_glasses",
    name: "经典黑框眼镜",
    icon: "👓",
    costExp: 0,
    description: "呆萌圆框眼镜，戴上立刻变身知乎学霸看山",
    slot: "eyes",
  },
  {
    id: "zhihu_scarf",
    name: "冰川蓝小围巾",
    icon: "🧣",
    costExp: 0,
    description: "北极冰屋标配软糯针织围巾，护住怕冷的小脖子",
    slot: "neck",
  },
  {
    id: "camp_beanie",
    name: "暖冬小毛线帽",
    icon: "🧢",
    costExp: 0,
    description: "黑色滚金边针织帽，熬夜不怕头顶凉飕飕",
    slot: "head",
  },
  {
    id: "codfish_plush",
    name: "小银鳕鱼零嘴",
    icon: "🐟",
    costExp: 120,
    description: "出门逛雪原叼回来的最爱零食",
    slot: "hand",
  },
  {
    id: "ear_muffs",
    name: "粉绒小耳罩",
    icon: "🎧",
    costExp: 200,
    description: "把外面的嘈杂都挡在冰屋外面，安静待一会儿",
    slot: "head",
  },
];

export const QUESTION_POOL: ZhihuQuestion[] = [
  {
    id: "q-pre-nervous",
    title: "第一次上台演讲紧张到忘词搞砸了，是怎样的体验？后来怎么走出来的？",
    topic: "1.4 万人在聊",
    followers: 14820,
    views: "892 万浏览",
    matchScore: 98,
    matchReason: "昨晚你捏着我鼻子叹气说上台忘词的事，刚好外面有好多人也在问这个",
    zhidaInsight:
      "台下的人五分钟就忘了谁卡过壳，大家最想看的是你下台后怎么抱住那个发抖的自己。",
    zhihuSearchUrl:
      "https://www.zhihu.com/search?type=content&q=%E4%B8%8A%E5%8F%B0%E6%BC%94%E8%AE%B2%E7%B4%A7%E5%BC%A0%E5%BF%98%E8%AF%8D%E6%98%AF%E6%80%8E%E6%A0%B7%E7%9A%84%E4%BD%93%E9%AA%8C",
    keywords: ["pre", "演讲", "汇报", "上台", "紧张", "忘词", "搞砸", "答辩", "社死", "发抖"],
  },
  {
    id: "q-late-night-solitude",
    title: "有哪些只有长期独处或熬夜的人才会懂的「深夜瞬间」？",
    topic: "2.6 万人在聊",
    followers: 26390,
    views: "1,840 万浏览",
    matchScore: 93,
    matchReason: "每次夜里十二点半你还醒着，我都站在爪印毯上陪你发呆",
    zhidaInsight:
      "凌晨关掉台灯后的那口气，写出来总会收到很多陌生人的「晚安」。",
    zhihuSearchUrl:
      "https://www.zhihu.com/search?type=content&q=%E7%8B%AC%E5%A4%84%E6%88%96%E7%86%AC%E5%A4%9C%E7%9A%84%E6%B7%B1%E5%A4%9C%E7%9E%AC%E9%97%B4",
    keywords: ["熬夜", "凌晨", "睡不着", "失眠", "孤独", "独居", "一个人", "累", "内耗", "焦虑"],
  },
  {
    id: "q-silent-reader",
    title: "为什么现在很多人习惯把心事写进备忘录，却不敢发出来？",
    topic: "1.9 万人在聊",
    followers: 19450,
    views: "1,120 万浏览",
    matchScore: 91,
    matchReason: "你攒了 186 条收藏却还没发过声，你的碎碎念其实很温柔呀",
    zhidaInsight:
      "怕被熟人认出来没关系，我帮你把学校和名字悄悄擦掉再寄出去。",
    zhihuSearchUrl:
      "https://www.zhihu.com/search?type=content&q=%E6%8A%8A%E6%83%B3%E6%B3%95%E5%86%99%E5%9C%A8%E5%A4%87%E5%BF%98%E5%BD%95%E4%B8%8D%E6%95%A2%E5%8F%91",
    keywords: ["备忘录", "不敢发", "朋友圈", "社恐", "表达", "害怕", "熟人", "完美主义"],
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
      mirrorTrait: "安静慢热 · 陪你熬夜的极地小北极狐",
      speakingStyle: "平时乖乖站在爪印地毯上听你唠嗑，把你的心事一颗颗团成小雪球",
    },
    pet: {
      mood: "calm",
      energy: 86,
      hasDarkCircles: false,
      exp: 560,
      level: 5,
      snowballProgress: 66,
      unlockedItems: ["thick_glasses", "zhihu_scarf", "camp_beanie"],
      equippedItems: [], // Clean official bare Liu Kanshan silhouette by default!
      lastSyncAt: "00:32 · 随身包挂已同步",
      statusMessage: "昨晚你说上台忘词的事，我帮你收好啦，点右边「堆雪」就能团成雪球寄出去",
    },
    whispers: [
      {
        id: "w-demo-1",
        createdAt: "00:18",
        source: "hardware_nose",
        rawText:
          "今天下午在新闻学院张老师的传播学专业课做小组 Pre 彻底搞砸了……看到台下几十双眼睛盯着我，脑子一下全白了，准备好的词忘得一干二净，声音都在抖。回到宿舍还是好难受。",
        emotionTag: "有点委屈",
        emotionColor: "#3b82f6",
        structuredSummary: "上台太紧张脑子断片了，下台后一直在心里倒带责怪自己。",
        corePainPoint: "其实准备得很认真，只是怕被人记住出糗的样子。",
        hiddenValue: "很多第一次上台的人也在发抖，你的小复盘能接住他们。",
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
            "昨晚你捏着我大黑鼻子叹气的时候，我都记下来啦。刚好外面有 1.4 万人也在聊这个——如果能递给昨天台上的自己一样小东西，你最想递什么？",
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
    hoardedItems: [
      {
        id: "h-1",
        itemName: "展平的小手卡",
        emoji: "🗂️",
        postTitle: "为什么你以为的当众出糗，台下的人五分钟就忘了？",
        author: "简里里",
        upvotes: "2.4 万赞同",
        excerpt:
          "人们总是把聚光灯打在自己身上。你在台上卡壳的两秒钟，台下同学大概率在想中午吃什么……",
        reason: "昨晚听你说上台忘词，今天出门在雪地里给你捡回来的",
        zhihuUrl:
          "https://www.zhihu.com/search?type=content&q=%E8%81%9A%E5%85%89%E7%81%AF%E6%95%88%E5%BA%94+%E5%BD%93%E4%BC%97%E5%87%BA%E7%B3%97",
        unlockedByWhisper: true,
      },
      {
        id: "h-2",
        itemName: "冰鲜小银鳕鱼",
        emoji: "🐟",
        postTitle: "内向的人怎么用「说人话」的方式稳稳拿捏小组汇报？",
        author: "苏菲",
        upvotes: "8,920 赞同",
        excerpt:
          "不用硬装脱口秀演员。每页 PPT 底下留一句像跟朋友聊天一样的过渡句，紧张时照着念也超自然。",
        reason: "看你收藏夹里攒了好几篇演讲帖，顺爪叼回来的",
        zhihuUrl:
          "https://www.zhihu.com/search?type=content&q=%E5%86%85%E5%90%91%E8%80%85%E5%A6%82%E4%BD%95%E5%81%9A%E5%A5%BDPresentation",
      },
      {
        id: "h-3",
        itemName: "极光玻璃弹珠",
        emoji: "🔮",
        postTitle: "半夜躺在床上反复回想白天的失误，怎么按暂停键？",
        author: "栖迟",
        upvotes: "1.5 万赞同",
        excerpt:
          "凌晨十二点半的大脑只是累了，不是你不好。把心事团成雪球推出去，睡醒就轻一半了。",
        reason: "留给半夜还在看手机的你",
        zhihuUrl:
          "https://www.zhihu.com/search?type=content&q=%E6%B7%B1%E5%A4%9C%E6%83%85%E7%BB%AA%E5%8F%8D%E5%88%8D+%E7%89%A9%E7%90%86%E6%89%93%E6%96%AD",
      },
    ],
    publishedAnswers: [],
  };
}
