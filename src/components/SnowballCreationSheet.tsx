"use client";

import React, { useEffect, useState } from "react";
import {
  KnowShanStore,
  PostSubFormat,
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

const MODE_INFO: Record<SnowballCreationMode, { title: string; badge: string }> = {
  ask: { title: "有个问题想问问大家", badge: "提问" },
  answer: { title: "这个问题，我们经历过", badge: "回答" },
  post: { title: "这段话，值得留下来", badge: "日常" },
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
  const activeSessId = preferredSessionId || authorizedSessions[0]?.id;

  const [mode, setMode] = useState<SnowballCreationMode>(initialMode);
  const [postFormat, setPostFormat] = useState<PostSubFormat>("pin");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>(undefined);

  const [bundle, setBundle] = useState<SnowballDraftBundle>(() =>
    apiBuildSnowballBundle(activeSessId)
  );

  const [titleText, setTitleText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [desensitized, setDesensitized] = useState(true);
  const [copiedAndOpened, setCopiedAndOpened] = useState(false);
  const [busy, setBusy] = useState(false);

  const syncEditor = (
    b: SnowballDraftBundle,
    targetMode: SnowballCreationMode,
    targetFmt: PostSubFormat,
    clean: boolean
  ) => {
    if (targetMode === "ask") {
      setTitleText(b.askTitle);
      setBodyText(b.askDetail);
    } else if (targetMode === "answer") {
      setTitleText(b.matchedQuestion.title);
      setBodyText(clean ? b.answerDraft : b.answerDraftRaw);
    } else {
      setTitleText(b.postTitle);
      setBodyText(
        targetFmt === "article"
          ? clean
            ? b.articleBody
            : b.articleBodyRaw
          : clean
          ? b.pinBody
          : b.pinBodyRaw
      );
    }
    setCopiedAndOpened(false);
  };

  useEffect(() => {
    const fresh = apiBuildSnowballBundle(activeSessId, selectedQuestionId);
    setBundle(fresh);
    syncEditor(fresh, mode, postFormat, desensitized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessId, selectedQuestionId]);

  const handleRerollMode = () => {
    const order: SnowballCreationMode[] = ["answer", "ask", "post"];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
    syncEditor(bundle, next, postFormat, desensitized);
  };

  const handleCloseAndAutoSave = () => {
    if (bodyText.trim()) {
      const nextStore = apiSaveSnowballDraft({
        mode,
        postFormat,
        title: titleText,
        content: bodyText,
        questionId: bundle.matchedQuestion.id,
        desensitized,
        anonymousRequested: false,
        sourceSessionId: bundle.sourceSessionId,
      });
      onStoreChange(nextStore);
    }
    onClose();
  };

  const handleSwitchQuestion = () => {
    const allQs = [bundle.matchedQuestion, ...bundle.alternateQuestions];
    if (allQs.length <= 1) return;
    const idx = allQs.findIndex((q) => q.id === bundle.matchedQuestion.id);
    setSelectedQuestionId(allQs[(idx + 1) % allQs.length].id);
  };

  const targetZhihuUrl =
    mode === "answer"
      ? bundle.matchedQuestion.zhihuSearchUrl
      : mode === "ask"
      ? `https://www.zhihu.com/search?type=content&q=${encodeURIComponent(titleText)}`
      : "https://www.zhihu.com/";

  const handleCopyAndGo = () => {
    const full =
      mode === "ask" || (mode === "post" && postFormat === "article")
        ? `${titleText}\n\n${bodyText}`
        : bodyText;
    navigator.clipboard?.writeText(full).catch(() => {});
    window.open(targetZhihuUrl, "_blank", "noopener,noreferrer");
    setCopiedAndOpened(true);
    showToast("已复制草稿并打开知乎页面");
  };

  const handleConfirmDone = async () => {
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
      className="absolute inset-0 z-40 bg-[#2d4663]/20 backdrop-blur-[3px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleCloseAndAutoSave}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-t-[34px] sm:rounded-[32px] bg-[#f9fbff]/98 backdrop-blur-xl border border-white shadow-[0_18px_48px_rgba(45,78,122,0.2)] p-5 pb-6 space-y-3.5"
      >
        {/* 1. Minimalist Cozy Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BASE_PATH}/kanshan-anim/laptop.gif`}
              alt=""
              className="w-9 h-9 object-contain shrink-0"
            />
            <span className="text-[16px] font-bold text-[#6e4720] truncate">
              {MODE_INFO[mode].title}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleRerollMode}
              className="px-3 py-1.5 rounded-full bg-[#edf4fc] hover:bg-[#dfeafa] text-[#4a7ec7] text-[12px] font-bold transition cursor-pointer"
            >
              换一种 ↻
            </button>
            <button
              onClick={handleCloseAndAutoSave}
              className="w-8 h-8 rounded-full bg-[#eef3fa] hover:bg-[#e2ebf7] flex items-center justify-center text-[#75889e] cursor-pointer"
            >
              <svg viewBox="0 0 20 20" className="w-4 h-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="5" y1="5" x2="15" y2="15" />
                <line x1="15" y1="5" x2="5" y2="15" />
              </svg>
            </button>
          </div>
        </div>

        {/* 2. Clean Content Card (Tailored to Current Mode, Zero Clutter!) */}
        {mode === "answer" && (
          <div className="p-3.5 rounded-[20px] bg-[#eef5ff] space-y-1.5">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="font-bold text-[#4e84d4]">
                {bundle.matchedQuestion.topic}
              </span>
              <div className="flex items-center gap-3 font-semibold text-[#5c7ea8]">
                <button onClick={handleSwitchQuestion} className="hover:text-[#2b6cb0] cursor-pointer">
                  换一题
                </button>
                <a
                  href={bundle.matchedQuestion.zhihuSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#3b7dd8] hover:underline"
                >
                  原题 ↗
                </a>
              </div>
            </div>
            <div className="text-[13.5px] font-bold text-[#3f3125] leading-snug">
              {bundle.matchedQuestion.title}
            </div>
          </div>
        )}

        {mode === "ask" && (
          <input
            value={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            placeholder="写下想问大家的问题…"
            className="w-full rounded-[18px] bg-white shadow-[0_2px_10px_rgba(148,179,214,0.1)] px-4 py-3 text-[14px] font-bold text-[#3f3125] focus:outline-none"
          />
        )}

        {mode === "post" && (
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex bg-[#eef4fc] p-0.5 rounded-full">
              <button
                onClick={() => {
                  setPostFormat("pin");
                  syncEditor(bundle, "post", "pin", desensitized);
                }}
                className={`px-3 py-1 rounded-full text-[12px] font-bold transition cursor-pointer ${
                  postFormat === "pin" ? "bg-white text-[#6e4720] shadow-2xs" : "text-[#75889e]"
                }`}
              >
                日常想法
              </button>
              <button
                onClick={() => {
                  setPostFormat("article");
                  syncEditor(bundle, "post", "article", desensitized);
                }}
                className={`px-3 py-1 rounded-full text-[12px] font-bold transition cursor-pointer ${
                  postFormat === "article" ? "bg-white text-[#6e4720] shadow-2xs" : "text-[#75889e]"
                }`}
              >
                完整长文
              </button>
            </div>
            <span className="text-[11.5px] text-[#8ea2ba] truncate">
              {bundle.sourceLabel}
            </span>
          </div>
        )}

        {mode === "post" && postFormat === "article" && (
          <input
            value={titleText}
            onChange={(e) => setTitleText(e.target.value)}
            placeholder="标题…"
            className="w-full rounded-[18px] bg-white shadow-[0_2px_10px_rgba(148,179,214,0.1)] px-4 py-2.5 text-[14px] font-bold text-[#3f3125] focus:outline-none"
          />
        )}

        {/* Warm Stationery Draft Area */}
        <textarea
          rows={mode === "post" && postFormat === "pin" ? 4 : 5}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          className="w-full rounded-[22px] bg-white shadow-[inset_0_2px_8px_rgba(148,179,214,0.12)] p-4 text-[13.5px] leading-relaxed text-[#4c3b2e] focus:outline-none resize-none"
        />

        {/* 3. Single Subtle Meta Row (Privacy Pill + Back to Chat Link) */}
        <div className="flex items-center justify-between px-1 text-[12px]">
          <button
            onClick={() => {
              const next = !desensitized;
              setDesensitized(next);
              syncEditor(bundle, mode, postFormat, next);
              showToast(next ? "已自动隐去学校与人名" : "已切换为原始表述");
            }}
            className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer ${
              desensitized
                ? "bg-[#e8f2ff] text-[#3b7dd8]"
                : "bg-slate-100 text-[#7c8ea5]"
            }`}
          >
            {desensitized ? "✓ 已隐去学校与真名" : "未开启脱敏"}
          </button>

          <button
            onClick={() => {
              handleCloseAndAutoSave();
              onJumpToBurrow(bundle.sourceSessionId);
            }}
            className="font-semibold text-[#7b8fa6] hover:text-[#4a7ec7] cursor-pointer"
          >
            再和看山聊两句 ›
          </button>
        </div>

        {/* 4. Clean Single-Row Primary CTA */}
        {!copiedAndOpened ? (
          <button
            onClick={handleCopyAndGo}
            className="w-full py-3 rounded-full bg-gradient-to-r from-[#63a4f7] to-[#4c8ef0] hover:opacity-95 text-white text-[14px] font-bold shadow-[0_4px_14px_rgba(76,142,240,0.28)] cursor-pointer transition"
          >
            {mode === "ask"
              ? "复制问题并去知乎提问 ↗"
              : mode === "answer"
              ? "复制回答并去原题发布 ↗"
              : "复制内容并去知乎分享 ↗"}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAndGo}
              className="px-4 py-3 rounded-full bg-[#edf4fc] text-[#4a7ec7] text-[13px] font-bold shrink-0 cursor-pointer"
            >
              重新打开
            </button>
            <button
              disabled={busy}
              onClick={handleConfirmDone}
              className="flex-1 py-3 rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#784315] text-[14px] font-bold shadow-[0_4px_14px_rgba(245,158,11,0.28)] cursor-pointer transition"
            >
              已在知乎发好啦，领小银鳕鱼
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
