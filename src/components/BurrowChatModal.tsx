"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChatSession, DollVoiceRecord, KnowShanStore } from "@/types/knowshan";
import {
  apiContinueFromDollVoice,
  apiCreateNewChatSession,
  apiDeleteChatSession,
  apiDeleteDollVoice,
  apiSelectChatSession,
  apiSendBurrowMessage,
} from "@/lib/client-api";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface BurrowChatModalProps {
  store: KnowShanStore;
  isFullWindow: boolean;
  onStoreChange: (next: KnowShanStore) => void;
  onClose: () => void;
  onGenerateSnowballFromSession: (sessionId: string) => void;
  showToast: (msg: string) => void;
}

export default function BurrowChatModal({
  store,
  isFullWindow,
  onStoreChange,
  onClose,
  onGenerateSnowballFromSession,
  showToast,
}: BurrowChatModalProps) {
  const [sidebarTab, setSidebarTab] = useState<"sessions" | "doll_voices">("sessions");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | undefined>(undefined);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef = useRef<any>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const activeSession: ChatSession =
    store.chatSessions.find((s) => s.id === store.activeSessionId) ||
    store.chatSessions[0];

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.id, activeSession?.messages.length, sending]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        speechRecRef.current?.stop();
        mediaRecRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const qLower = searchQuery.trim().toLowerCase();
  const filteredSessions = store.chatSessions.filter(
    (s) =>
      !qLower ||
      s.title.toLowerCase().includes(qLower) ||
      s.messages.some((m) => m.content.toLowerCase().includes(qLower))
  );
  const filteredVoices = store.dollVoiceRecords.filter(
    (v) => !qLower || v.transcript.toLowerCase().includes(qLower)
  );

  const startVoiceRecording = async () => {
    setRecordSec(0);
    setIsRecording(true);
    timerRef.current = setInterval(() => setRecordSec((p) => p + 1), 1000);

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (ev) => {
          if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };
        mr.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
            setPendingAudioUrl(URL.createObjectURL(blob));
          }
        };
        mr.start();
        mediaRecRef.current = mr;
      } catch {
        // fallback cleanly to text
      }
    }

    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        try {
          const rec = new SR();
          rec.lang = "zh-CN";
          rec.continuous = true;
          rec.interimResults = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rec.onresult = (e: any) => {
            let t = "";
            for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
            if (t) setInputText(t);
          };
          rec.start();
          speechRecRef.current = rec;
        } catch {
          // ignore
        }
      }
    }
  };

  const stopVoiceRecording = (cancel = false) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      speechRecRef.current?.stop();
      mediaRecRef.current?.stop();
    } catch {
      // ignore
    }
    setIsRecording(false);
    if (cancel) {
      setPendingAudioUrl(undefined);
      setRecordSec(0);
      return;
    }
    if (!inputText.trim()) {
      setInputText("刚忙完松了一口气，想进树洞跟看山随便唠两句。");
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    const wasVoice = Boolean(pendingAudioUrl || recordSec > 0);
    const dur = recordSec || undefined;
    const url = pendingAudioUrl;
    setInputText("");
    setPendingAudioUrl(undefined);
    setRecordSec(0);

    try {
      const res = await apiSendBurrowMessage({
        sessionId: activeSession?.id,
        content: text,
        inputType: wasVoice ? "voice" : "text",
        source: "web",
        audioUrl: url,
        durationSec: dur,
      });
      onStoreChange(res.store);
    } finally {
      setSending(false);
    }
  };

  const handlePlayVoice = (id: string, transcript: string, audioUrl?: string) => {
    if (playingId === id) {
      audioPlayerRef.current?.pause();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.play().catch(() => setPlayingId(null));
      return;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(transcript);
      utter.lang = "zh-CN";
      utter.rate = 1.02;
      utter.onend = () => setPlayingId(null);
      utter.onerror = () => setPlayingId(null);
      window.speechSynthesis.speak(utter);
    } else {
      setTimeout(() => setPlayingId(null), 2000);
    }
  };

  const handleContinueFromVoice = (v: DollVoiceRecord) => {
    const res = apiContinueFromDollVoice(v.id);
    onStoreChange(res.store);
    setDrawerOpen(false);
    showToast("已接着玩偶录音继续聊天");
  };

  const showStaticSidebar = isFullWindow;

  return (
    <div
      className="absolute inset-0 z-40 bg-[#273e59]/22 backdrop-blur-[3px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${
          isFullWindow ? "h-[86vh] max-w-[820px] rounded-[32px]" : "h-[85%] rounded-t-[34px]"
        } bg-[#f7faff]/98 border border-white shadow-[0_18px_50px_rgba(38,70,112,0.22)] flex overflow-hidden relative`}
      >
        {/* =============================================================== */}
        {/* CLEAN SIDEBAR (Static in wide full-window; Slide-over in phone) */}
        {/* =============================================================== */}
        <div
          className={`${
            drawerOpen
              ? "flex absolute inset-y-0 left-0 z-30 w-[264px] shadow-xl"
              : showStaticSidebar
              ? "hidden md:flex md:w-[252px]"
              : "hidden"
          } shrink-0 bg-[#edf4fd] border-r border-white flex-col p-3.5 gap-2.5`}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onStoreChange(apiCreateNewChatSession());
                setSidebarTab("sessions");
                setDrawerOpen(false);
              }}
              className="flex-1 py-2 rounded-full bg-[#63a4f7] hover:bg-[#4e92ee] text-white text-[12.5px] font-bold cursor-pointer transition"
            >
              + 新对话
            </button>
            {drawerOpen && (
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-white text-[#647890] flex items-center justify-center cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索记录…"
            className="w-full px-3.5 py-1.5 rounded-full bg-white text-[12px] text-[#4c3b2e] placeholder:text-[#9cb0c6] focus:outline-none"
          />

          <div className="flex bg-white/75 p-0.5 rounded-full">
            <button
              onClick={() => setSidebarTab("sessions")}
              className={`flex-1 py-1.5 rounded-full text-[11.5px] font-bold transition cursor-pointer ${
                sidebarTab === "sessions"
                  ? "bg-white text-[#6e4720] shadow-2xs"
                  : "text-[#7a8da3]"
              }`}
            >
              会话 ({store.chatSessions.length})
            </button>
            <button
              onClick={() => setSidebarTab("doll_voices")}
              className={`flex-1 py-1.5 rounded-full text-[11.5px] font-bold transition cursor-pointer ${
                sidebarTab === "doll_voices"
                  ? "bg-white text-[#6e4720] shadow-2xs"
                  : "text-[#7a8da3]"
              }`}
            >
              玩偶声音 ({store.dollVoiceRecords.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
            {sidebarTab === "sessions"
              ? filteredSessions.map((sess) => {
                  const isActive = sess.id === activeSession?.id;
                  const lastMsg = sess.messages[sess.messages.length - 1];
                  return (
                    <div
                      key={sess.id}
                      onClick={() => {
                        onStoreChange(apiSelectChatSession(sess.id));
                        setDrawerOpen(false);
                      }}
                      className={`group px-3 py-2.5 rounded-[16px] transition cursor-pointer ${
                        isActive
                          ? "bg-white ring-1.5 ring-[#63a4f7] shadow-2xs"
                          : "bg-white/60 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12.5px] font-bold text-[#4c3b2e] truncate">
                          {sess.title}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStoreChange(apiDeleteChatSession(sess.id));
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[12px] text-[#a0b1c5] hover:text-[#ef4444] px-1 cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                      <p className="text-[11px] text-[#7f92a8] truncate mt-0.5">
                        {lastMsg?.content || "新对话"}
                      </p>
                    </div>
                  );
                })
              : filteredVoices.map((v) => (
                  <div
                    key={v.id}
                    className="p-2.5 rounded-[16px] bg-white/90 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10.5px] text-[#8ea2ba]">
                      <span className="font-bold text-[#b46914]">
                        玩偶录音 · {v.durationSec}&quot;
                      </span>
                      <button
                        onClick={() => onStoreChange(apiDeleteDollVoice(v.id))}
                        className="hover:text-[#ef4444] cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                    <p className="text-[12px] text-[#4c3b2e] line-clamp-2 leading-snug">
                      {v.transcript}
                    </p>
                    <div className="flex items-center justify-between pt-0.5">
                      <button
                        onClick={() => handlePlayVoice(v.id, v.transcript, v.audioUrl)}
                        className="text-[11px] font-bold text-[#4a7ec7] cursor-pointer"
                      >
                        {playingId === v.id ? "■ 停止" : "▶ 听原声"}
                      </button>
                      <button
                        onClick={() => handleContinueFromVoice(v)}
                        className="px-2.5 py-0.5 rounded-full bg-[#e8f2ff] text-[#3b7dd8] text-[11px] font-bold cursor-pointer"
                      >
                        接着聊 ›
                      </button>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* =============================================================== */}
        {/* MAIN COMPANION CHAT AREA                                        */}
        {/* =============================================================== */}
        <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-[#f9fbff] to-[#eff6ff]">
          {/* Clean Single-Row Top Bar */}
          <div className="px-4 py-3 bg-white/85 backdrop-blur-md border-b border-[#e8f0fb] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setDrawerOpen(!drawerOpen)}
                className={`${
                  showStaticSidebar ? "md:hidden" : ""
                } w-8 h-8 rounded-full bg-[#edf4fc] text-[#4a7ec7] flex items-center justify-center shrink-0 cursor-pointer`}
                title="历史与玩偶语音"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="3.5" y1="6" x2="16.5" y2="6" />
                  <line x1="3.5" y1="10" x2="16.5" y2="10" />
                  <line x1="3.5" y1="14" x2="12.5" y2="14" />
                </svg>
              </button>

              <div className="w-8 h-8 rounded-full bg-[#e6f2fe] overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${BASE_PATH}/kanshan-anim/wave.gif`} alt="" className="w-8 h-8 object-cover" />
              </div>

              <span className="text-[14.5px] font-bold text-[#5a3d20] truncate">
                {activeSession?.title || "树洞"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {activeSession && (
                <button
                  onClick={() => onGenerateSnowballFromSession(activeSession.id)}
                  className="px-3 py-1.5 rounded-full bg-[#edf4fc] hover:bg-[#dfeafa] text-[#4a7ec7] text-[12px] font-bold cursor-pointer"
                >
                  团成雪球
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#eef3fa] hover:bg-[#e2ebf7] flex items-center justify-center text-[#75889e] cursor-pointer"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="5" y1="5" x2="15" y2="15" />
                  <line x1="15" y1="5" x2="5" y2="15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {activeSession?.messages.map((m) => {
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-white shadow-2xs overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${BASE_PATH}/kanshan-anim/idle.gif`} alt="" className="w-7 h-7 object-contain" />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-[20px] text-[13.5px] leading-relaxed ${
                      isUser
                        ? "bg-[#63a4f7] text-white rounded-br-[6px]"
                        : "bg-white text-[#4c3b2e] shadow-[0_2px_10px_rgba(140,170,210,0.1)] rounded-bl-[6px]"
                    }`}
                  >
                    {(m.source === "doll" || m.inputType === "voice") && (
                      <button
                        onClick={() => handlePlayVoice(m.id, m.content, m.audioUrl)}
                        className={`flex items-center gap-1.5 text-[11px] font-bold mb-1 ${
                          isUser ? "text-white/90" : "text-[#4a7ec7]"
                        } cursor-pointer`}
                      >
                        <span>{playingId === m.id ? "■ 停止" : "▶ 语音"}</span>
                        {m.durationSec && <span>{m.durationSec}&quot;</span>}
                      </button>
                    )}
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="text-[12px] text-[#8ea2ba] pl-9">看山正在听…</div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Clean Input Bar */}
          <div className="p-3 bg-white/90 border-t border-[#e8f0fb]">
            {isRecording ? (
              <div className="flex items-center justify-between px-4 py-2 rounded-full bg-[#e8f2ff]">
                <div className="flex items-center gap-2 text-[12.5px] font-bold text-[#2563eb]">
                  <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
                  <span>正在听（{recordSec}s）…</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => stopVoiceRecording(false)}
                    className="px-3 py-1 rounded-full bg-[#63a4f7] text-white text-[12px] font-bold cursor-pointer"
                  >
                    完成
                  </button>
                  <button
                    onClick={() => stopVoiceRecording(true)}
                    className="text-[12px] text-[#75889e] px-2 cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={startVoiceRecording}
                  title="语音输入"
                  className="w-10 h-10 rounded-full bg-[#edf4fc] hover:bg-[#dfeafa] text-[#4a7ec7] flex items-center justify-center shrink-0 cursor-pointer transition"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <line x1="12" y1="18" x2="12" y2="21" />
                  </svg>
                </button>

                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="跟看山随便聊聊…"
                  className="flex-1 rounded-full bg-[#f3f7fd] px-4 py-2.5 text-[13.5px] text-[#3f3125] placeholder:text-[#9cb0c6] focus:outline-none focus:bg-white"
                />

                <button
                  disabled={!inputText.trim() || sending}
                  onClick={handleSend}
                  className="px-4 py-2.5 rounded-full bg-[#63a4f7] disabled:opacity-40 text-white text-[13px] font-bold shrink-0 cursor-pointer transition"
                >
                  发送
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
