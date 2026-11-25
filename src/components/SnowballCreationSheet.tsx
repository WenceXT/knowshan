"use client";

import React, { useEffect, useState } from "react";
import {
  KnowShanStore,
  PostSubFormat,
  SavedSnowballDraft,
  SnowballCreationMode,
  SnowballDraftBundle,
} from "@/types/knowshan";
import { apiBuildSnowballBundle, apiSaveSnowballDraft } from "@/lib/client-api";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface SnowballCreationSheetProps {
  store: KnowShanStore;
  initialMode: SnowballCreationMode;
  preferredSessionId?: string;
  onClose: () => void;
  onJumpToBurrow: (sessionId?: string) => void;
  onStoreChange: (nextStore: KnowShanStore) => void;
  onConfirmPublished: (payload: {
    creationType: SnowballCreationMode;
    questionId: string;
    title: string;
    content: string;
    desensitized: boolean;
    redactedTerms: string[];
  }) => Promise<void>;
  showToast: (msg: string) => void;
}

const MODE_META: Record<
  SnowballCreationMode,
  {
    tabLabel: string;
    headline: string;
    kanshanLine: string;
  }
> = {
  ask: {
    tabLabel: "发起提问",
    headline: "我们好像有一个问题想问大家！",
    kanshanLine: "把刚才还没想通的小纠结整理成了一个知乎提问，要不要听听过来人怎么说？",
  },
  answer: {
    tabLabel: "回答问题",
    headline: "这个问题，我们好像真的经历过！",
    kanshanLine: "在知乎上找到了一个真实同频提问，我已经按你的亲身经历理好回答草稿啦。",
  },
  post: {
    tabLabel: "独立内容 · 日常",
    headline: "我们好像有个故事值得记录！",
    kanshanLine: "这段话很真诚，值得留下来做成一篇独立帖子或轻量日常动态。",
  },
};

export default function SnowballCreationSheet({
  store,
  initialMode,
  preferredSessionId,
  onClose,
  onJumpToBurrow,
  onStoreChange,
  onConfirmPublished,
  showToast,
}: SnowballCreationSheetProps) {
  const authorizedSessions = (store.chatSessions || []).filter((s) => s.allowForCreation);

  const [mode, setMode] = useState<SnowballCreationMode>(initialMode);
  const [postFormat, setPostFormat] = useState<PostSubFormat>("article");
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(
    preferredSessionId || authorizedSessions[0]?.id
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>(undefined);

  const [bundle, setBundle] = useState<SnowballDraftBundle>(() =>
    apiBuildSnowballBundle(preferredSessionId || authorizedSessions[0]?.id)
  );

  const [titleText, setTitleText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [isEdited, setIsEdited] = useState(false);

  const [desensitized, setDesensitized] = useState(true);
  const [anonymousOpt, setAnonymousOpt] = useState(false);
  const [copiedAndOpened, setCopiedAndOpened] = useState(false);
  const [busy, setBusy] = useState(false);

  // Hydrate editable fields from bundle whenever mode / format / source changes (unless user manually edited)
  const applyBundleToEditor = (
    b: SnowballDraftBundle,
    targetMode: SnowballCreationMode,
    targetFormat: PostSubFormat,
    useDesensitized: boolean
  ) => {
    if (targetMode === "ask") {
      setTitleText(b.askTitle);
      setBodyText(b.askDetail);
    } else if (targetMode === "answer") {
      setTitleText(b.matchedQuestion.title);
      setBodyText(useDesensitized ? b.answerDraft : b.answerDraftRaw);
    } else {
      setTitleText(b.postTitle);
      if (targetFormat === "article") {
        setBodyText(useDesensitized ? b.articleBody : b.articleBodyRaw);
      } else {
        setBodyText(useDesensitized ? b.pinBody : b.pinBodyRaw);
      }
    }
    setIsEdited(false);
    setCopiedAndOpened(false);
  };

  useEffect(() => {
    const fresh = apiBuildSnowballBundle(selectedSessionId, selectedQuestionId);
    setBundle(fresh);
    applyBundleToEditor(fresh, mode, postFormat, desensitized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId, selectedQuestionId]);

  const switchMode = (nextMode: SnowballCreationMode) => {
    setMode(nextMode);
    applyBundleToEditor(bundle, nextMode, postFormat, desensitized);
  };

  const rerollRandomMode = () => {
    const others = (["ask", "answer", "post"] as SnowballCreationMode[]).filter(
      (m) => m !== mode
    );
    const picked = others[Math.floor(Math.random() * others.length)];
    switchMode(picked);
    showToast(`已切换为「${MODE_META[picked].tabLabel}」`);
  };

  const switchPostFormat = (fmt: PostSubFormat) => {
    setPostFormat(fmt);
    applyBundleToEditor(bundle, "post", fmt, desensitized);
  };

  const handleRegenerate = () => {
    if (isEdited && !window.confirm("重新整理会覆盖你刚才手动修改的文字，确定重新整理吗？")) {
      return;
    }
    const fresh = apiBuildSnowballBundle(selectedSessionId, selectedQuestionId);
    setBundle(fresh);
    applyBundleToEditor(fresh, mode, postFormat, desensitized);
    showToast("已根据授权记录重新整理草稿");
  };

  const handleSwitchMatchedQuestion = () => {
    const allQs = [bundle.matchedQuestion, ...bundle.alternateQuestions];
    if (allQs.length <= 1) return;
    const curIdx = allQs.findIndex((q) => q.id === bundle.matchedQuestion.id);
    const nextQ = allQs[(curIdx + 1) % allQs.length];
    setSelectedQuestionId(nextQ.id);
    showToast("已为你换一个真实知乎问题");
  };

  const handleSaveDraft = () => {
    const nextStore = apiSaveSnowballDraft({
      mode,
      postFormat,
      title: titleText,
      content: bodyText,
      questionId: bundle.matchedQuestion.id,
      desensitized,
      anonymousRequested: anonymousOpt,
      sourceSessionId: bundle.sourceSessionId,
    });
    onStoreChange(nextStore);
    showToast("草稿已妥善保存，随时回来都能接着改");
  };

  const handleRestoreSavedDraft = (d: SavedSnowballDraft) => {
    setMode(d.mode);
    setPostFormat(d.postFormat);
    setTitleText(d.title);
    setBodyText(d.content);
    setDesensitized(d.desensitized);
    setAnonymousOpt(d.anonymousRequested);
    setIsEdited(true);
    showToast("已恢复上次保存的草稿");
  };

  const targetZhihuUrl =
    mode === "answer"
      ? bundle.matchedQuestion.zhihuSearchUrl
      : mode === "ask"
      ? `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(titleText)}`
      : "https://www.zhihu.com/";

  const handleCopyAndGoZhihu = () => {
    const textToCopy =
      mode === "ask"
        ? `${titleText}\n\n${bodyText}`
        : mode === "post" && postFormat === "article"
        ? `${titleText}\n\n${bodyText}`
        : bodyText;

    navigator.clipboard?.writeText(textToCopy).catch(() => {});
    window.open(targetZhihuUrl, "_blank", "noopener,noreferrer");
    setCopiedAndOpened(true);
    showToast("已复制草稿并打开知乎页面，粘贴发布后回来点确认即可领小鱼！");
  };

  const handleFinalConfirmPublished = async () => {
    setBusy(true);
    try {
      await onConfirmPublished({
        creationType: mode,
        questionId: bundle.matchedQuestion.id,
        title: titleText,
        content: bodyText,
        desensitized,
        redactedTerms: bundle.redactedTerms,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 bg-[#2b4360]/25 backdrop-blur-[3px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[540px] rounded-t-[34px] sm:rounded-[32px] bg-[#f8fbff]/98 backdrop-blur-xl border border-white shadow-[0_18px_50px_rgba(45,78,122,0.22)] p-5 pb-6 max-h-[86vh] overflow-y-auto space-y-3.5"
      >
        {/* Header + Random Reroll */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BASE_PATH}/kanshan-anim/laptop.gif`}
              alt="看山整理中"
              className="w-10 h-10 object-contain shrink-0"
            />
            <div>
              <div className="text-[16px] font-bold text-[#6e4720] leading-snug">
                {MODE_META[mode].headline}
              </div>
              <div className="text-[12px] text-[#7c8ea5] mt-0.5 leading-snug">
                {MODE_META[mode].kanshanLine}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#e8f0fa] hover:bg-[#dce8f7] flex items-center justify-center text-[#647890] shrink-0 cursor-pointer"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="5" y1="5" x2="15" y2="15" />
              <line x1="15" y1="5" x2="5" y2="15" />
            </svg>
          </button>
        </div>

        {/* 3 Creation Modes Tabs + "换一种" */}
        <div className="flex items-center justify-between gap-2 bg-[#eaf2fc] p-1 rounded-full">
          <div className="flex flex-1 items-center gap-1">
            {(["ask", "answer", "post"] as SnowballCreationMode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-1.5 px-2 rounded-full text-[12px] font-bold transition cursor-pointer ${
                  mode === m
                    ? "bg-[#63a4f7] text-white shadow-2xs"
                    : "text-[#5f748d] hover:bg-white/60"
                }`}
              >
                {MODE_META[m].tabLabel}
              </button>
            ))}
          </div>
          <button
            onClick={rerollRandomMode}
            className="px-3 py-1.5 rounded-full bg-white text-[#784315] text-[12px] font-bold shadow-2xs hover:bg-[#fff9eb] shrink-0 cursor-pointer"
          >
            换一种
          </button>
        </div>

        {/* Authorized Content Source Bar + Jump back to Burrow */}
        <div className="px-3.5 py-2.5 rounded-[18px] bg-white border border-[#e3eefb] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-[#e8f2ff] text-[#3b7dd8] text-[11px] font-bold shrink-0">
              生成依据
            </span>
            {authorizedSessions.length > 1 ? (
              <select
                value={selectedSessionId || ""}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="text-[12px] font-semibold text-[#4c3b2e] bg-transparent focus:outline-none truncate cursor-pointer"
              >
                {authorizedSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    树洞会话：{s.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[12px] font-semibold text-[#5a4636] truncate">
                {bundle.sourceLabel}
              </span>
            )}
          </div>

          <button
            onClick={() => {
              handleSaveDraft();
              onJumpToBurrow(bundle.sourceSessionId);
            }}
            className="text-[12px] font-bold text-[#528be0] hover:text-[#2b6cb0] shrink-0 cursor-pointer"
          >
            再和刘看山聊聊 ›
          </button>
        </div>

        {/* Saved Drafts Quick Bar (if any) */}
        {store.savedDrafts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <span className="text-[11px] text-[#8496ab] shrink-0">已存草稿：</span>
            {store.savedDrafts.slice(0, 3).map((d) => (
              <button
                key={d.id}
                onClick={() => handleRestoreSavedDraft(d)}
                className="px-2.5 py-1 rounded-full bg-white border border-[#e2ecf9] text-[11px] font-semibold text-[#5f738a] hover:bg-[#f0f6ff] truncate max-w-[160px] cursor-pointer"
              >
                {d.title || "未命名草稿"}
              </button>
            ))}
          </div>
        )}

        {/* =============================================================== */}
        {/* MODE 1: AI 帮助发起提问                                          */}
        {/* =============================================================== */}
        {mode === "ask" && (
          <div className="space-y-2.5">
            <div>
              <label className="block text-[12px] font-bold text-[#647890] mb-1">
                拟发布的知乎问题标题（可修改）
              </label>
              <input
                value={titleText}
                onChange={(e) => {
                  setTitleText(e.target.value);
                  setIsEdited(true);
                }}
                className="w-full rounded-[16px] bg-white border border-[#dde9f8] px-3.5 py-2.5 text-[14px] font-bold text-[#3f3125] focus:outline-none focus:ring-2 focus:ring-[#7cb4f8]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[#647890] mb-1">
                问题背景与补充说明（可修改）
              </label>
              <textarea
                rows={4}
                value={bodyText}
                onChange={(e) => {
                  setBodyText(e.target.value);
                  setIsEdited(true);
                }}
                className="w-full rounded-[18px] bg-white border border-[#dde9f8] p-3.5 text-[13px] leading-relaxed text-[#4c3b2e] focus:outline-none focus:ring-2 focus:ring-[#7cb4f8]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {bundle.askTopics.map((tp) => (
                <span
                  key={tp}
                  className="px-2.5 py-1 rounded-full bg-[#edf5ff] text-[11px] font-semibold text-[#4a80d4]"
                >
                  #{tp}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* MODE 2: AI 整理经历回答知乎已有真实问题（重点展示）                */}
        {/* =============================================================== */}
        {mode === "answer" && (
          <div className="space-y-3">
            {/* A. Verified Real Zhihu Question Card */}
            <div className="p-3.5 rounded-[20px] bg-gradient-to-br from-[#edf5ff] to-[#f5f9ff] border border-[#d4e5fb] space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded-full bg-[#63a4f7] text-white font-bold">
                  知乎原问题 · {bundle.matchedQuestion.topic}
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleSwitchMatchedQuestion}
                    className="font-bold text-[#5a7ea8] hover:text-[#2b6cb0] cursor-pointer"
                  >
                    换一个问题
                  </button>
                  <a
                    href={bundle.matchedQuestion.zhihuSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[#3b7dd8] hover:underline"
                  >
                    查看知乎原问题 ↗
                  </a>
                </div>
              </div>

              <div className="text-[14px] font-bold text-[#3f3125] leading-snug">
                {bundle.matchedQuestion.title}
              </div>

              <div className="text-[12px] text-[#5c7899]">
                匹配理由：{bundle.matchedQuestion.matchReason}
              </div>
            </div>

            {/* B. Editable User Answer Draft */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[12px] font-bold text-[#647890]">
                  为你整理的真实经历回答草稿（可自由增删修改）
                </label>
                <span className="text-[11px] text-[#8ea2ba]">不编造未发生事实</span>
              </div>
              <textarea
                rows={5}
                value={bodyText}
                onChange={(e) => {
                  setBodyText(e.target.value);
                  setIsEdited(true);
                }}
                className="w-full rounded-[18px] bg-white border border-[#dde9f8] p-3.5 text-[13px] leading-relaxed text-[#4c3b2e] focus:outline-none focus:ring-2 focus:ring-[#7cb4f8]"
              />
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* MODE 3: 独立内容（文章） / 日常动态（想法）                       */}
        {/* =============================================================== */}
        {mode === "post" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between bg-white border border-[#e1ecfa] rounded-full p-1">
              <button
                onClick={() => switchPostFormat("article")}
                className={`flex-1 py-1.5 rounded-full text-[12px] font-bold transition cursor-pointer ${
                  postFormat === "article"
                    ? "bg-[#fbbf24] text-[#784315]"
                    : "text-[#6e7f94]"
                }`}
              >
                独立内容（完整帖子）
              </button>
              <button
                onClick={() => switchPostFormat("pin")}
                className={`flex-1 py-1.5 rounded-full text-[12px] font-bold transition cursor-pointer ${
                  postFormat === "pin"
                    ? "bg-[#fbbf24] text-[#784315]"
                    : "text-[#6e7f94]"
                }`}
              >
                日常动态（轻量想法）
              </button>
            </div>

            {postFormat === "article" && (
              <div>
                <label className="block text-[12px] font-bold text-[#647890] mb-1">
                  推荐标题（可修改）
                </label>
                <input
                  value={titleText}
                  onChange={(e) => {
                    setTitleText(e.target.value);
                    setIsEdited(true);
                  }}
                  className="w-full rounded-[16px] bg-white border border-[#dde9f8] px-3.5 py-2 text-[14px] font-bold text-[#3f3125] focus:outline-none focus:ring-2 focus:ring-[#7cb4f8]"
                />
              </div>
            )}

            <div>
              <label className="block text-[12px] font-bold text-[#647890] mb-1">
                {postFormat === "article" ? "完整帖子正文" : "日常想法短动态"}（可修改）
              </label>
              <textarea
                rows={postFormat === "article" ? 5 : 3}
                value={bodyText}
                onChange={(e) => {
                  setBodyText(e.target.value);
                  setIsEdited(true);
                }}
                className="w-full rounded-[18px] bg-white border border-[#dde9f8] p-3.5 text-[13px] leading-relaxed text-[#4c3b2e] focus:outline-none focus:ring-2 focus:ring-[#7cb4f8]"
              />
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* PRIVACY DESENSITIZATION & HONEST ANONYMOUS SWITCH               */}
        {/* =============================================================== */}
        <div className="rounded-[18px] bg-[#f0f6ff] px-3.5 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[#496992]">
              隐私脱敏保护（{bundle.redactedTerms.join(" · ")}）
            </span>
            <input
              type="checkbox"
              checked={desensitized}
              onChange={(e) => {
                const next = e.target.checked;
                setDesensitized(next);
                applyBundleToEditor(bundle, mode, postFormat, next);
              }}
              className="accent-[#5b9bf8] w-4 h-4 shrink-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[#dce9fa] pt-2">
            <span className="text-[12px] font-semibold text-[#496992]">
              匿名发布选项
            </span>
            <input
              type="checkbox"
              checked={anonymousOpt}
              onChange={(e) => setAnonymousOpt(e.target.checked)}
              className="accent-[#5b9bf8] w-4 h-4 shrink-0 cursor-pointer"
            />
          </div>

          {anonymousOpt && (
            <div className="text-[11px] text-[#b45309] bg-[#fffbeb] border border-[#fde68a] rounded-xl px-2.5 py-1.5 leading-snug">
              提示：知乎当前社区该发布形式暂不支持匿名身份，不会以匿名自动直发；已为你开启上方「隐私脱敏保护」自动隐去学校与人名。
            </div>
          )}
        </div>

        {/* =============================================================== */}
        {/* HONEST ACTION BAR (Copy + Go Zhihu -> Explicit Confirm Reward)  */}
        {/* =============================================================== */}
        <div className="space-y-2 pt-0.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleSaveDraft}
                className="px-3 py-2 rounded-full bg-white border border-[#dce8f7] text-[12px] font-bold text-[#5f738a] hover:bg-[#f4f8ff] cursor-pointer"
              >
                保存草稿
              </button>
              <button
                onClick={handleRegenerate}
                className="px-3 py-2 rounded-full bg-white border border-[#dce8f7] text-[12px] font-bold text-[#5f738a] hover:bg-[#f4f8ff] cursor-pointer"
              >
                重新整理
              </button>
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-full text-[12px] font-semibold text-[#8496ab] hover:text-[#5f738a] cursor-pointer"
              >
                取消
              </button>
            </div>

            <button
              onClick={handleCopyAndGoZhihu}
              className="px-4 py-2.5 rounded-full bg-gradient-to-r from-[#63a4f7] to-[#4b8df2] text-white text-[13px] font-bold shadow-xs hover:opacity-95 cursor-pointer"
            >
              {mode === "ask"
                ? "复制并去知乎提问 ↗"
                : mode === "answer"
                ? "复制回答并去原题 ↗"
                : "复制并去知乎发布 ↗"}
            </button>
          </div>

          {copiedAndOpened && (
            <div className="p-3 rounded-[18px] bg-[#fff9e6] border border-[#fde68a] flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-[#854d0e]">
                草稿已复制并打开知乎页面！在知乎完成发布后点右侧领小鱼奖励：
              </span>
              <button
                disabled={busy}
                onClick={handleFinalConfirmPublished}
                className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#784315] text-[12px] font-bold shrink-0 shadow-2xs cursor-pointer"
              >
                我已发布，领小鱼
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
