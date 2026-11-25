import { NextResponse } from "next/server";
import { readStore, resetStoreToStoryline, writeStore } from "@/lib/store";
import { ACCESSORIES } from "@/lib/seed";
import { computePersonaMirror } from "@/lib/ai-engine";
import { PetMood } from "@/types/knowshan";

export async function GET() {
  const store = readStore();
  return NextResponse.json({ store, accessories: ACCESSORIES });
}

export async function POST(req: Request) {
  const body = await req.json();
  const store = readStore();
  const now = new Date();
  const syncTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} · 双端已同步`;

  if (body.action === "reset_storyline") {
    const fresh = resetStoreToStoryline();
    return NextResponse.json({ store: fresh, accessories: ACCESSORIES });
  }

  if (body.action === "hardware_interact") {
    const type = body.interactType as "head_pat" | "cheek_pinch" | "sleep_toggle" | "late_night_toggle" | "morning_greet";
    if (type === "head_pat") {
      store.pet.mood = "happy";
      store.pet.energy = Math.min(100, store.pet.energy + 6);
      store.pet.exp += 5;
      store.pet.statusMessage = "（眯起眼睛蹭了蹭你的手心）被摸头啦！今天的焦虑值 -10%，经验值 +5～";
    } else if (type === "cheek_pinch") {
      store.pet.mood = "sly";
      store.pet.exp += 5;
      store.pet.statusMessage = "（露出奸诈的笑 ¬‿¬）捏我脸出气可以，捏完记得把刚才那个绝妙吐槽记下来换赞同！";
    } else if (type === "sleep_toggle") {
      const goingToSleep = store.pet.mood !== "sleeping";
      store.pet.mood = goingToSleep ? "sleeping" : "calm";
      if (goingToSleep) {
        store.pet.hasDarkCircles = false;
        store.pet.energy = 100;
        store.pet.statusMessage = "Zzz… 包挂眼屏已熄灯休眠，晚安，明早我带着新问题叫你起床。";
      } else {
        store.pet.statusMessage = "早安！黑眼圈消掉啦，精神满满的一天，来看看知友都在聊什么吧！";
      }
    } else if (type === "late_night_toggle") {
      store.pet.hasDarkCircles = !store.pet.hasDarkCircles;
      store.pet.mood = store.pet.hasDarkCircles ? ("night_owl" as PetMood) : "calm";
      store.pet.statusMessage = store.pet.hasDarkCircles
        ? "检测到已过凌晨 01:00，刘看山同步长出了黑眼圈，倾诉完早点拍拍我睡觉哦。"
        : "作息恢复规律，刘看山的黑眼圈退散啦！";
    } else if (type === "morning_greet") {
      store.pet.mood = "happy";
      store.pet.hasDarkCircles = false;
      store.pet.statusMessage = "通勤包挂早安播报：今天你关注的「演讲与表达」话题有 2 个高共鸣新问题正在冒泡！";
    }
    store.pet.level = Math.floor(store.pet.exp / 120) + 1;
    store.pet.lastSyncAt = syncTime;
    writeStore(store);
    return NextResponse.json({ store });
  }

  if (body.action === "toggle_accessory") {
    const itemId = body.itemId as string;
    const item = ACCESSORIES.find((a) => a.id === itemId);
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    if (!store.pet.unlockedItems.includes(itemId)) {
      if (store.pet.exp < item.costExp) {
        return NextResponse.json({ error: "经验值不足，快去冒泡探讨或堆雪人发帖赚经验吧！" }, { status: 400 });
      }
      store.pet.unlockedItems.push(itemId);
    }

    if (store.pet.equippedItems.includes(itemId)) {
      store.pet.equippedItems = store.pet.equippedItems.filter((id) => id !== itemId);
    } else {
      store.pet.equippedItems.push(itemId);
    }
    store.pet.lastSyncAt = syncTime;
    store.pet.statusMessage = `已同步穿戴「${item.name}」至网页宠物与 3D 实体包挂！`;
    writeStore(store);
    return NextResponse.json({ store });
  }

  if (body.action === "update_persona") {
    const { mbti, nickname, roleTag, zhihuInterests, oauthConnected } = body;
    if (mbti) store.persona.mbti = mbti;
    if (nickname) store.persona.nickname = nickname;
    if (roleTag) store.persona.roleTag = roleTag;
    if (Array.isArray(zhihuInterests) && zhihuInterests.length > 0) {
      store.persona.zhihuInterests = zhihuInterests;
    }
    if (typeof oauthConnected === "boolean") {
      store.persona.oauthConnected = oauthConnected;
    }
    const mirror = computePersonaMirror(store.persona.mbti, store.persona.zhihuInterests);
    store.persona.mirrorTrait = mirror.mirrorTrait;
    store.persona.speakingStyle = mirror.speakingStyle;
    store.pet.lastSyncAt = syncTime;
    store.pet.statusMessage = `性格镜像已重塑为「${store.persona.mbti} · ${mirror.mirrorTrait}」！`;
    writeStore(store);
    return NextResponse.json({ store });
  }

  if (body.action === "select_question") {
    store.activeQuestionId = body.questionId;
    writeStore(store);
    return NextResponse.json({ store });
  }

  return NextResponse.json({ store });
}
