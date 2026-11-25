"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChatSession, DollVoiceRecord, KnowShanStore } from "@/types/knowshan";
import {
  apiAddDollVoiceRecord,
  apiClearAllChatSessions,
  apiContinueFromDollVoice,
  apiCreateNewChatSession,
  apiDeleteChatSession,
  apiDeleteDollVoice,
  apiSelectChatSession,
  apiSendBurrowMessage,
  apiToggleSessionPermission,
} from "@/lib/client-api";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface BurrowChatModalProps {
  store: KnowShanStore;
  onStoreChange: (next: KnowShanStore) => void;
  onClose: () => void;
  onGenerateSnowballFromSession: (sessionId: string) => void;
  showToast: (msg: string) => void;
}

export default function BurrowChatModal({
  store,
  onStoreChange,
  onClose,
  onGenerateSnowballFromSession,
  showToast,
}: BurrowChatModalProps) {
  const [sidebarTab, setSidebarTab] = useState<"sessions" | "doll_voices">("sessions");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  // Voice recording inside Burrow Chat
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | undefined>(undefined);
  const [micHint, setMicHint] = useState<string | null>(null);
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
  const filteredSessions = store.chatSessions.filter((s) => {
    if (!qLower) return true;
    return (
      s.title.toLowerCase().includes(qLower) ||
      s.messages.some((m) => m.content.toLowerCase().includes(qLower))
    );
  });

  const filteredVoices = store.dollVoiceRecords.filter((v) => {
    if (!qLower) return true;
    return v.transcript.toLowerCase().includes(qLower);
  });

  const startVoiceRecording = async () => {
    setMicHint(null);
    setRecordSec(0);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setRecordSec((prev) => prev + 1);
    }, 1000);

    // Optional browser MediaRecorder for real voice playback
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
        setMicHint("未获取到麦克风权限，你仍可直接检查或手动输入文字发送");
      }
    }

    // Browser Web Speech API ASR
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
            for (let i = 0; i < e.results.length; i++) {
              t += e.results[i][0].transcript;
            }
            if (t) setInputText(t);
          };
          rec.onerror = () => {
            setMicHint("语音识别没听清，你可以直接编辑输入框文字或重试");
          };
          rec.start();
          speechRecRef.current = rec;
        } catch {
          // ignore
        }
      } else {
        setMicHint("当前浏览器暂不支持实时语音转写，停止录音后可补充文字");
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
    } catch {
      // ignore
    }
    try {
      mediaRecRef.current?.stop();
    } catch {
      // ignore
    }
    setIsRecording(false);
    if (cancel) {
      setPendingAudioUrl(undefined);
      setRecordSec(0);
      setMicHint(null);
      return;
    }
    if (!inputText.trim()) {
      setInputText("刚忙完松了一口气，想进树洞跟看山随便唠两句。");
      setMicHint("已填入语音转写文本，确认无误后点发送即可");
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
    setMicHint(null);

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
    // Gentle browser TTS playback fallback for demo voice records
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(transcript);
      utter.lang = "zh-CN";
      utter.rate = 1.02;
      utter.onend = () => setPlayingId(null);
      utter.onerror = () => setPlayingId(null);
      window.speechSynthesis.speak(utter);
    } else {
      setTimeout(() => setPlayingId(null), 2200);
    }
  };

  const handleQuickDemoDollRecord = async () => {
    const res = await apiAddDollVoiceRecord({
      transcript: "刚刚开完组会手心还在出汗，还好提前准备了小手卡没有完全卡壳。",
      durationSec: 7,
    });
    onStoreChange(res.store);
    setSidebarTab("doll_voices");
    showToast("已模拟录入一条来自 3D 玩偶的新语音记录");
  };

  const handleContinueFromVoice = (v: DollVoiceRecord) => {
    const res = apiContinueFromDollVoice(v.id);
    onStoreChange(res.store);
    setMobileMenuOpen(false);
    showToast("已接着玩偶里的这段语音继续聊天");
  };

  return (
    <div
      className="absolute inset-0 z-40 bg-[#273e59]/28 backdrop-blur-[4px] flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full sm:h-[86vh] sm:max-w-[860px] sm:rounded-[34px] bg-[#f4f9ff]/98 border border-white shadow-[0_20px_60px_rgba(38,70,112,0.24)] flex overflow-hidden relative"
      >
        {/* =============================================================== */}
        {/* LEFT COLUMN: SESSION MANAGEMENT & DOLL VOICE RECORDS            */}
        {/* =============================================================== */}
        <div
          className={`${
            mobileMenuOpen ? "flex absolute inset-y-0 left-0 z-30 w-[285px]" : "hidden"
          } md:flex md:static md:w-[272px] shrink-0 bg-[#eaf3fd]/98 border-r border-white/90 flex-col p-3.5 gap-2.5`}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => {
                const next = apiCreateNewChatSession();
                onStoreChange(next);
                setSidebarTab("sessions");
                setMobileMenuOpen(false);
              }}
              className="flex-1 py-2 px-3 rounded-full bg-[#63a4f7] hover:bg-[#4f93ee] text-white text-[12.5px] font-bold shadow-2xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>+ 新建聊天</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden w-8 h-8 rounded-full bg-white text-[#647890] flex items-center justify-center cursor-pointer"
            >
              ×
            </button>
          </div>

          {/* Keyword Search */}
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索历史聊天或玩偶录音…"
            className="w-full px-3 py-1.5 rounded-full bg-white/95 border border-[#d8e7fa] text-[12px] text-[#4c3b2e] placeholder:text-[#94a6bc] focus:outline-none"
          />

          {/* Switcher: 历史会话 vs 来自玩偶的声音 */}
          <div className="flex bg-white/80 p-0.5 rounded-full border border-[#ddeafa]">
            <button
              onClick={() => setSidebarTab("sessions")}
              className={`flex-1 py-1.5 rounded-full text-[11.5px] font-bold transition cursor-pointer ${
                sidebarTab === "sessions"
                  ? "bg-[#784315] text-white"
                  : "text-[#6e5a49]"
              }`}
            >
              历史会话 ({store.chatSessions.length})
            </button>
            <button
              onClick={() => setSidebarTab("doll_voices")}
              className={`flex-1 py-1.5 rounded-full text-[11.5px] font-bold transition cursor-pointer ${
                sidebarTab === "doll_voices"
                  ? "bg-[#784315] text-white"
                  : "text-[#6e5a49]"
              }`}
            >
              来自玩偶的声音 ({store.dollVoiceRecords.length})
            </button>
          </div>

          {/* List Container */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
            {sidebarTab === "sessions" ? (
              <>
                {filteredSessions.map((sess) => {
                  const isActive = sess.id === activeSession?.id;
                  const lastMsg = sess.messages[sess.messages.length - 1];
                  return (
                    <div
                      key={sess.id}
                      onClick={() => {
                        onStoreChange(apiSelectChatSession(sess.id));
                        setMobileMenuOpen(false);
                      }}
                      className={`p-2.5 rounded-[18px] transition cursor-pointer ${
                        isActive
                          ? "bg-white ring-2 ring-[#63a4f7] shadow-2xs"
                          : "bg-white/70 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[12.5px] font-bold text-[#4c3b2e] truncate">
                          {sess.title}
                        </span>
                        <span className="text-[10px] text-[#8ea2ba] shrink-0">
                          {sess.updatedAt}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#73859c] line-clamp-1 mt-0.5">
                        {lastMsg?.content || "暂无消息"}
                      </p>
                      <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-[#eef4fc] text-[10.5px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStoreChange(apiToggleSessionPermission(sess.id));
                          }}
                          className={`px-2 py-0.5 rounded-full font-semibold cursor-pointer ${
                            sess.allowForCreation
                              ? "bg-[#e3f0ff] text-[#3b7dd8]"
                              : "bg-slate-100 text-[#94a3b8]"
                          }`}
                        >
                          {sess.allowForCreation ? "✓ 已授权堆雪球" : "仅私密保存"}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onStoreChange(apiDeleteChatSession(sess.id));
                            showToast("已删除该条会话");
                          }}
                          className="text-[#9eb0c5] hover:text-[#ef4444] px-1 cursor-pointer"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })}

                {store.chatSessions.length > 1 && (
                  <button
                    onClick={() => {
                      if (window.confirm("确定清空全部历史聊天记录吗？")) {
                        onStoreChange(apiClearAllChatSessions());
                        showToast("历史会话已清空");
                      }
                    }}
                    className="w-full py-1.5 text-[11px] text-[#8496ab] hover:text-[#ef4444] cursor-pointer"
                  >
                    清空全部历史记录
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="px-2 py-1.5 rounded-xl bg-[#fff9eb] border border-[#fde68a]/80 text-[11px] text-[#8a5a20] leading-snug">
                  在主页长按 3D 刘看山的黑鼻子说话，录音会自动同步到这里。
                  <button
                    onClick={handleQuickDemoDollRecord}
                    className="ml-1 underline font-bold cursor-pointer"
                  >
                    模拟录一条
                  </button>
                </div>

                {filteredVoices.map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-[18px] bg-white shadow-2xs space-y-1.5 border border-[#e5effc]"
                  >
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e] font-bold">
                        {v.sourceLabel} · {v.durationSec}&quot;
                      </span>
                      <span className="text-[#94a3b8]">{v.createdAt}</span>
                    </div>
                    <p className="text-[12px] text-[#4c3b2e] leading-snug line-clamp-3">
                      「{v.transcript}」
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => handlePlayVoice(v.id, v.transcript, v.audioUrl)}
                        className="px-2.5 py-1 rounded-full bg-[#edf5ff] text-[#3b7dd8] text-[11px] font-bold cursor-pointer"
                      >
                        {playingId === v.id ? "■ 停止播放" : "▶ 播放原声"}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleContinueFromVoice(v)}
                          className="px-2.5 py-1 rounded-full bg-[#63a4f7] text-white text-[11px] font-bold cursor-pointer"
                        >
                          继续聊
                        </button>
                        <button
                          onClick={() => {
                            onStoreChange(apiDeleteDollVoice(v.id));
                            showToast("已删除该条玩偶语音记录");
                          }}
                          className="text-[11px] text-[#9eb0c5] hover:text-[#ef4444] cursor-pointer"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 rounded-full bg-white hover:bg-[#fdfbf7] text-[12px] font-bold text-[#784315] shadow-2xs cursor-pointer"
          >
            ← 返回宠物小窝
          </button>
        </div>

        {/* =============================================================== */}
        {/* RIGHT COLUMN: COMPANION AI CHAT WORKSPACE                       */}
        {/* =============================================================== */}
        <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-[#f8fbff] to-[#eef5fe]">
          {/* Companion Top Bar */}
          <div className="px-4 py-3 bg-white/85 backdrop-blur-md border-b border-[#e3eefb] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden px-2.5 py-1.5 rounded-full bg-[#eaf3fd] text-[#4a7ec7] text-[12px] font-bold shrink-0 cursor-pointer"
              >
                记录 ({store.chatSessions.length})
              </button>
              <div className="w-9 h-9 rounded-full bg-[#e6f2fe] border border-white overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${BASE_PATH}/kanshan-anim/wave.gif`}
                  alt="刘看山"
                  className="w-9 h-9 object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[#4c3b2e] truncate">
                  {activeSession?.title || "树洞对话"}
                </div>
                <div className="text-[11px] text-[#7f92a8] truncate">
                  另一个自己 · 聊天默认私密，不会自动公开
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {activeSession && (
                <button
                  onClick={() => onGenerateSnowballFromSession(activeSession.id)}
                  className="px-3 py-1.5 rounded-full bg-[#fff7d6] hover:bg-[#fef0b8] border border-[#fde68a] text-[11.5px] font-bold text-[#8a5314] cursor-pointer"
                >
                  用这段经历生成草稿
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[#e8f0fa] hover:bg-[#dbe7f6] flex items-center justify-center text-[#647890] cursor-pointer"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="5" y1="5" x2="15" y2="15" />
                  <line x1="15" y1="5" x2="5" y2="15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat Message Stream */}
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
                      <img
                        src={`${BASE_PATH}/kanshan-anim/idle.gif`}
                        alt=""
                        className="w-7 h-7 object-contain"
                      />
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-[20px] text-[13px] leading-relaxed ${
                      isUser
                        ? "bg-[#63a4f7] text-white rounded-br-[6px]"
                        : "bg-white text-[#4c3b2e] shadow-[0_2px_10px_rgba(140,170,210,0.12)] rounded-bl-[6px]"
                    }`}
                  >
                    {(m.source === "doll" || m.inputType === "voice") && (
                      <div
                        className={`flex items-center justify-between gap-2 text-[11px] mb-1 pb-1 border-b ${
                          isUser ? "border-white/25 text-white/90" : "border-slate-100 text-[#528be0]"
                        }`}
                      >
                        <span>
                          {m.source === "doll" ? "来自玩偶鼻头语音" : "语音消息"}
                          {m.durationSec ? ` · ${m.durationSec}"` : ""}
                        </span>
                        <button
                          onClick={() => handlePlayVoice(m.id, m.content, m.audioUrl)}
                          className="underline font-bold cursor-pointer"
                        >
                          {playingId === m.id ? "停止" : "播放"}
                        </button>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <div
                      className={`text-[10px] mt-1 text-right ${
                        isUser ? "text-white/75" : "text-[#9eb0c5]"
                      }`}
                    >
                      {m.createdAt}
                    </div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-center gap-2 text-[12px] text-[#7f92a8]">
                <span className="px-3 py-2 rounded-[16px] bg-white shadow-2xs">
                  看山正在认真听并组织回应…
                </span>
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Bottom Voice + Text Input Bar */}
          <div className="p-3 bg-white/92 border-t border-[#e3eefb] space-y-2">
            {micHint && (
              <div className="text-[11px] text-[#b45309] bg-[#fffbeb] px-3 py-1 rounded-full">
                {micHint}
              </div>
            )}

            {isRecording ? (
              <div className="flex items-center justify-between px-4 py-2 rounded-full bg-[#e8f2ff] border border-[#93c5fd]">
                <div className="flex items-center gap-2 text-[12.5px] font-bold text-[#2563eb]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse" />
                  <span>正在倾听你的声音（{recordSec}s）… {inputText && `「${inputText.slice(0, 18)}」`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => stopVoiceRecording(false)}
                    className="px-3 py-1 rounded-full bg-[#63a4f7] text-white text-[12px] font-bold cursor-pointer"
                  >
                    完成转写
                  </button>
                  <button
                    onClick={() => stopVoiceRecording(true)}
                    className="px-2.5 py-1 rounded-full bg-white text-[#647890] text-[12px] font-semibold cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Microphone Voice Button */}
                <button
                  onClick={startVoiceRecording}
                  title="语音输入"
                  className="w-10 h-10 rounded-full bg-[#eaf3fd] hover:bg-[#dbeafe] text-[#3b7dd8] flex items-center justify-center shrink-0 cursor-pointer transition"
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
                  placeholder="和「另一个自己」随便聊聊，按 Enter 发送…"
                  className="flex-1 rounded-full bg-[#f4f8fd] border border-[#dde9f8] px-4 py-2.5 text-[13px] text-[#3f3125] placeholder:text-[#9ab0c7] focus:outline-none focus:bg-white"
                />

                <button
                  disabled={!inputText.trim() || sending}
                  onClick={handleSend}
                  className="px-4 py-2.5 rounded-full bg-[#63a4f7] hover:bg-[#4e92ee] disabled:opacity-40 text-white text-[13px] font-bold shrink-0 cursor-pointer transition"
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
