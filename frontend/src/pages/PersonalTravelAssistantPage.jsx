import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, History, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { chatWithAgent, chatWithAgentStream, getAgentSession, getAgentSessions, useBuddy, deleteAgentSession } from '../services/api';
import { createDiary } from '../services/api/diaries';
import { uploadImage } from '../services/api/media-upload';
import ChatBubble from '../components/Chat/ChatBubble';
import ChatInput from '../components/Chat/ChatInput';
import QuickChips from '../components/Chat/QuickChips';
import DiaryModal from '../components/Chat/DiaryModal';
import NewChatModal from '../components/Chat/NewChatModal';
import TypingIndicator from '../components/Chat/TypingIndicator';

const formatTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const ACTION_MESSAGES = {
  diary: '帮我写一篇旅行日记，配上好看的文案',
};

function PersonalTravelAssistantPage() {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sending, setSending] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [selectedBuddy, setSelectedBuddy] = useState(null);
  const [selectedBuddyName, setSelectedBuddyName] = useState('');
  const [diaryModalOpen, setDiaryModalOpen] = useState(false);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const msgEndRef = useRef(null);

  // Refs to avoid stale closure issues in async send
  const sendingRef = useRef(false);
  const streamingRef = useRef(false);
  const sessionIdRef = useRef(null);
  const buddyRef = useRef(null);
  const actionFiredRef = useRef(false);

  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }, []);

  const userId = currentUser?.id || 'anonymous';

  // Keep refs in sync
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { buddyRef.current = selectedBuddy; }, [selectedBuddy]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getAgentSessions(userId);
        if (res.success) {
          const list = res.data || [];
          setSessions(list);
          if (list.length > 0) setSessionId(list[0].sessionId);
        }
      } catch { /* offline */ }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const mergeSession = useCallback((s) => {
    if (!s?.sessionId) return;
    setSessions((p) => {
      const existing = p.find((i) => i.sessionId === s.sessionId);
      if (existing) return p.map((i) => i.sessionId === s.sessionId ? { ...i, ...s } : i);
      return [s, ...p];
    });
  }, []);

  // Stable send function — uses refs to avoid stale closures
  // existingPaths: 已上传的服务器路径（如换风格时复用已有图片，跳过上传步骤）
  const handleSend = useCallback(async (text, images = [], existingPaths = []) => {
    if ((!text && images.length === 0 && existingPaths.length === 0) || sendingRef.current) return;

    sendingRef.current = true;
    streamingRef.current = true;
    setSending(true);
    setAgentError('');

    // 上传图片到服务器（顺序上传，避免并发连接数限制）
    let serverImagePaths = [...existingPaths];
    if (images.length > 0) {
      try {
        // 逐个上传，避免浏览器对同一 host 的并发连接数限制（Chrome: 6）
        for (const img of images) {
          try {
            const r = await uploadImage(img.file);
            if (r.success && r.data?.path) {
              serverImagePaths.push(r.data.path);
            }
          } catch {
            // 单张失败不阻塞其他图片
            console.warn('单张图片上传失败，继续上传其余图片');
          }
        }
        if (serverImagePaths.length === 0 && images.length > 0) {
          setAgentError('所有图片上传失败，请重试');
          sendingRef.current = false;
          streamingRef.current = false;
          setSending(false);
          return;
        }
      } catch {
        setAgentError('图片上传失败，请确认服务已启动');
        sendingRef.current = false;
        streamingRef.current = false;
        setSending(false);
        return;
      }
    }

    // 用户消息：含本地预览图（气泡展示用）+ 服务器路径 + base64（AI 分析用）
    const userMsg = {
      _id: crypto.randomUUID(),
      role: 'user',
      content: text,
      images: images.map((img) => img.preview),    // 本地预览（ChatBubble 渲染用）
      serverImages: serverImagePaths,               // 服务器路径（存储用）
      createdAt: new Date().toISOString(),
    };
    setMessages((p) => [...p, userMsg]);

    const sid = sessionIdRef.current;
    const buddyId = buddyRef.current;
    // 构建 metadata：serverImagePaths 用于存储，imageDataUrls (base64) 用于 AI 视觉分析
    const imageDataUrls = images.map((img) => img.preview);  // base64 data URLs
    const metadata = {
      ...(buddyId ? { buddy_id: buddyId } : {}),
      ...(serverImagePaths.length > 0 ? { images: serverImagePaths } : {}),
      ...(imageDataUrls.length > 0 ? { image_data_urls: imageDataUrls } : {}),
    };

    let fullContent = '';

    // Try SSE streaming first
    try {
      const stream = chatWithAgentStream({ userId, sessionId: sid, message: text, metadata });
      const placeholder = { _id: crypto.randomUUID(), role: 'assistant', content: '', createdAt: new Date().toISOString(), streaming: true };
      setMessages((p) => [...p, placeholder]);

      let finalData = null;

      for await (const evt of stream) {
        if (!streamingRef.current) break;
        if (evt.event === 'token') {
          fullContent += evt.data.content || '';
          setMessages((p) => {
            const copy = [...p];
            const last = copy[copy.length - 1];
            if (last?.streaming) copy[copy.length - 1] = { ...last, content: fullContent };
            return copy;
          });
        } else if (evt.event === 'done') {
          finalData = evt.data;
          fullContent = finalData.content || fullContent;
        } else if (evt.event === 'error') {
          // SSE gave a structured error — remove placeholder and signal fallback needed
          setMessages((p) => p.filter((m) => !m.streaming));
          fullContent = '';
          break;
        }
      }

      if (finalData) {
        const doneContent = finalData.content || fullContent;
        const isDiaryCard = finalData.diary_card || finalData.isDiaryCard;
        const xhsNotes = finalData.xhsNotes;
        setMessages((p) => {
          const copy = [...p];
          const last = copy[copy.length - 1];
          if (last?.streaming) copy[copy.length - 1] = {
            ...last,
            content: doneContent,
            streaming: false,
            ...(isDiaryCard ? {
              diaryCard: true,
              diaryStyle: finalData.diary_style || finalData.diaryStyle || '小红书',
              serverImages: finalData.serverImages || serverImagePaths,
            } : {}),
            ...(xhsNotes && xhsNotes.length > 0 ? { xhsNotes } : {}),
          };
          return copy;
        });
        // Extract session from SSE done event
        const sseSid = finalData.session_id || finalData.session?.sessionId || finalData.session?.session_id;
        const sseSession = finalData.session;
        if (sseSid) {
          setSessionId(sseSid);
          sessionIdRef.current = sseSid;
        }
        if (sseSession) mergeSession(sseSession);
        fullContent = doneContent; // ensure fallback is skipped even if fullContent was cleared by a late error
      } else if (fullContent) {
        // Tokens arrived but no final done event — finalize without fallback
        setMessages((p) => {
          const copy = [...p];
          const last = copy[copy.length - 1];
          if (last?.streaming) copy[copy.length - 1] = { ...last, streaming: false };
          return copy;
        });
        // Refresh sessions in case a new session was created (sid was null)
        if (!sid) {
          try {
            const refresh = await getAgentSessions(userId);
            if (refresh.success && refresh.data?.length > 0) {
              setSessions(refresh.data);
              setSessionId(refresh.data[0].sessionId);
              sessionIdRef.current = refresh.data[0].sessionId;
            }
          } catch { /* keep current state */ }
        }
      }
    } catch {
      // Only clean up and fallback if we got no tokens at all
      if (!fullContent) {
        setMessages((p) => p.filter((m) => !m.streaming));
      } else {
        // Got tokens but generator threw — finalize what we have
        setMessages((p) => {
          const copy = [...p];
          const last = copy[copy.length - 1];
          if (last?.streaming) copy[copy.length - 1] = { ...last, streaming: false };
          return copy;
        });
        // Refresh sessions in case a new session was created (sid was null)
        if (!sid) {
          try {
            const refresh = await getAgentSessions(userId);
            if (refresh.success && refresh.data?.length > 0) {
              setSessions(refresh.data);
              setSessionId(refresh.data[0].sessionId);
              sessionIdRef.current = refresh.data[0].sessionId;
            }
          } catch { /* keep current state */ }
        }
      }
    }

    // Fallback to sync API only if streaming produced NO content
    if (!fullContent) {
      setMessages((p) => p.filter((m) => !m.streaming));
      const res = await chatWithAgent({ userId, sessionId: sid, message: text, metadata });
      if (!res.success) {
        setMessages((p) => p.filter((m) => m !== userMsg));
        setAgentError(res.message || '发送失败');
      } else {
        const s = res.data?.session;
        const reply = res.data?.reply;
        const isDiaryCardSync = reply?.metadata?.diary_card || reply?.diaryCard;
        const xhsNotesSync = reply?.metadata?.xhsNotes;
        if (s) {
          setSessionId(s.sessionId);
          sessionIdRef.current = s.sessionId;
          const msgs = (s.messages || []).map((m) => {
            const base = { ...m, _id: m._id || crypto.randomUUID() };
            // 标记日记卡片消息
            if (isDiaryCardSync && m.role === 'assistant' && m.content === reply?.content) {
              return {
                ...base,
                diaryCard: true,
                diaryStyle: reply?.metadata?.diary_style || reply?.metadata?.diaryStyle || '小红书',
                serverImages: reply?.metadata?.serverImages || serverImagePaths,
                ...(xhsNotesSync && xhsNotesSync.length > 0 ? { xhsNotes: xhsNotesSync } : {}),
              };
            }
            // 标记 XHS 笔记（非日记卡片消息）
            if (xhsNotesSync && xhsNotesSync.length > 0 && m.role === 'assistant' && m.content === reply?.content && !isDiaryCardSync) {
              return { ...base, xhsNotes: xhsNotesSync };
            }
            return base;
          });
          setMessages(msgs);
          mergeSession(s);
        }
      }
    }

    sendingRef.current = false;
    streamingRef.current = false;
    setSending(false);
  }, [userId, mergeSession]); // stable: only changes when userId or mergeSession changes

  // Auto-fire diary action from query param
  useEffect(() => {
    if (actionFiredRef.current || loading) return;
    const action = searchParams.get('action');
    if (action === 'diary') {
      actionFiredRef.current = true;
      const timer = setTimeout(() => handleSend(ACTION_MESSAGES.diary), 600);
      return () => clearTimeout(timer);
    }
  }, [loading, searchParams, handleSend]);

  const handleQuickChip = useCallback((message) => {
    handleSend(message);
  }, [handleSend]);

  const handleDiaryOpen = useCallback(() => {
    setDiaryModalOpen(true);
  }, []);

  const handleDiaryCreated = useCallback((diaryId) => {
    setDiaryModalOpen(false);
  }, []);

  // 对话式游记卡片操作
  const handlePublishDiary = useCallback(async (message) => {
    if (!message.content) return;
    const msgId = message._id;

    // 设置发布中状态
    setMessages((p) => p.map((m) => {
      if (m._id === msgId) return { ...m, diaryPublishing: true };
      return m;
    }));

    try {
      // 从消息内容中提取标题
      // 跳过图片分析/地点识别等非标题行（如 "**📍地点识别：...**"），找真正的日记标题
      const IMAGE_ANALYSIS_PATTERNS = /^📍|地点识别|图片.*识别|识别.*图片|画面描述|图像分析|拍摄.*分析/;
      const lines = message.content.trim().split('\n');
      let titleLine = '';
      for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const stripped = lines[i].replace(/^[#\*\-\s]+/, '').trim();
        if (stripped.length > 3 && !IMAGE_ANALYSIS_PATTERNS.test(stripped)) {
          titleLine = lines[i];
          break;
        }
      }
      if (!titleLine) titleLine = lines[0] || '';
      const cleaned = titleLine
        .replace(/^#+\s*/, '')
        .replace(/^#{1,6}\s*/, '')
        .replace(/^\*+/, '')
        .replace(/\*+$/, '')
        .trim();
      const title = cleaned.length > 3 && cleaned.length < 50
        ? cleaned
        : message.content.slice(0, 20).replace(/\n/g, ' ').trim();

      // 聚合对话中所有用户消息的图片（兜底：确保历史图片不丢失）
      // message.serverImages 由调度器注入，正常情况已包含全量图片；
      // 若注入链路异常（如 diary_card 未正确传递），此处从全部消息中补救。
      const allImageSet = new Set();
      const addImage = (img) => {
        const url = typeof img === 'string' ? img : (img?.path || img?.url || '');
        if (url) allImageSet.add(url);
      };
      setMessages((p) => {
        for (const m of p) {
          if (m.role !== 'user') continue;
          // 用户消息上的 serverImages 含已上传服务器路径
          for (const img of (m.serverImages || [])) addImage(img);
          // 用户消息上的 images 也可能有路径（兼容旧格式）
          for (const img of (m.images || [])) addImage(img);
        }
        return p; // 不变更状态，仅读取快照
      });
      const allConversationImages = [...allImageSet];
      // message.serverImages 优先（Agent 已聚合）；fallback 到对话全量聚合
      const publishImages = (message.serverImages && message.serverImages.length > 0)
        ? message.serverImages
        : allConversationImages;

      // 直接调 Java 后端 POST /api/diaries，不经过 Python agent（避免 urllib→Java 的超时问题）
      const res = await createDiary({
        title: title || '旅行日记',
        content: message.content,
        authorId: String(userId),
        images: publishImages,
        tags: message.diaryTags || [],
        placeId: '',
      });

      if (res.success && res.data) {
        const diaryId = res.data.id || res.data.diaryId || '';
        setMessages((p) => p.map((m) => {
          if (m._id === msgId) {
            return {
              ...m,
              diaryPublishing: false,
              diaryPublished: true,
              diaryId,
            };
          }
          return m;
        }));
      } else {
        setMessages((p) => p.map((m) => {
          if (m._id === msgId) {
            return {
              ...m,
              diaryPublishing: false,
              diaryPublishError: res.message || '发布失败，请重试',
            };
          }
          return m;
        }));
      }
    } catch {
      setMessages((p) => p.map((m) => {
        if (m._id === msgId) {
          return {
            ...m,
            diaryPublishing: false,
            diaryPublishError: '发布失败，请确认后端服务已启动',
          };
        }
        return m;
      }));
    }
  }, [userId]);

  const handleRestyleDiary = useCallback((message, selectedStyle) => {
    // 换风格：转发已有图片，让用户选择新风格
    const existingImages = message.serverImages || message.images || [];
    const styleText = selectedStyle || '另一种风格';
    handleSend(`帮我把这篇游记换成${styleText}风格重新写`, [], existingImages);
  }, [handleSend]);

  const handleEditDiary = useCallback((message, newContent) => {
    // 编辑：更新消息内容
    setMessages((p) => p.map((m) => {
      if (m === message) {
        return { ...m, content: newContent };
      }
      return m;
    }));
  }, []);

  // New chat: open modal to pick buddy first
  const handleNewChat = useCallback(() => {
    streamingRef.current = false;
    setNewChatModalOpen(true);
  }, []);

  const handleNewChatConfirm = useCallback(async (buddyId, buddyName) => {
    setNewChatModalOpen(false);
    setSessionId(null);
    sessionIdRef.current = null;
    setMessages([]);
    setAgentError('');
    streamingRef.current = false;

    if (buddyId) {
      setSelectedBuddy(buddyId);
      setSelectedBuddyName(buddyName || '');
      buddyRef.current = buddyId;
      try { await useBuddy(buddyId, userId); } catch { /* ignore */ }
    } else {
      setSelectedBuddy(null);
      setSelectedBuddyName('');
      buddyRef.current = null;
    }
  }, [userId]);

  const handleSelectSession = async (id) => {
    if (id === sessionId) return;
    streamingRef.current = false;
    sendingRef.current = false;
    setSending(false);
    setSessionId(id);
    sessionIdRef.current = id;
    setSessionLoading(true);
    try {
      const res = await getAgentSession(id, userId);
      if (res.success && res.data) {
        setMessages((res.data.messages || []).map((m) => ({ ...m, _id: m._id || crypto.randomUUID() })));
      } else {
        setMessages([]);
      }
    } catch {
      setMessages([]);
    } finally {
      setSessionLoading(false);
    }
  };

  const handleDeleteSession = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteAgentSession(id, userId);
      setSessions((p) => p.filter((s) => s.sessionId !== id));
      if (sessionId === id) {
        setSessionId(null);
        sessionIdRef.current = null;
        setMessages([]);
      }
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] md:min-h-0">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-surface flex-shrink-0">
        <div className="p-4">
          <button
            onClick={handleNewChat}
            className="w-full py-2.5 bg-heading text-white text-xs uppercase tracking-widest font-sans hover:opacity-90 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={14} /> 新对话
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <p className="font-sans text-[10px] uppercase tracking-widest text-muted px-2 py-2">历史对话</p>
          {sessions.length === 0 ? (
            <p className="font-sans text-xs text-muted px-2">暂无历史对话</p>
          ) : (
            sessions.slice(0, 20).map((s) => (
              <div
                key={s.sessionId}
                onClick={() => handleSelectSession(s.sessionId)}
                className={'group flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm transition-colors ' +
                  (s.sessionId === sessionId
                    ? 'bg-accent-soft text-heading'
                    : 'text-muted hover:bg-accent-soft hover:text-heading')}
              >
                <History size={13} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-xs truncate">{(s.title || s.preview || '新对话').slice(0, 18)}</p>
                  <p className="font-sans text-[10px] text-muted">{s.updatedAt ? formatTime(s.updatedAt) : ''}</p>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, s.sessionId)}
                  className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface">
        {selectedBuddyName && (
          <div className="px-4 py-2 border-b border-border bg-accent-soft/50 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-muted">当前搭子</span>
            <span className="text-xs font-medium text-heading">{selectedBuddyName}</span>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {sessionLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle size={40} className="text-muted mb-4" />
              <p className="font-sans text-sm text-muted mb-1">输入旅行问题开始对话</p>
              <p className="font-sans text-xs text-muted">试试说"推荐杭州一日游路线"或点下方快捷入口</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <ChatBubble
                key={(m.role || 'msg') + '-' + i}
                message={m}
                className={m.streaming ? 'streaming-message' : ''}
                onPublishDiary={handlePublishDiary}
                onRestyleDiary={handleRestyleDiary}
                onEditDiary={handleEditDiary}
                publishingDiary={m.diaryPublishing}
              />
            ))
          )}
          {sending && <TypingIndicator />}
          <div ref={msgEndRef} />
        </div>

        {agentError && (
          <div className="mx-4 mb-2 flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle size={14} />
            <span className="flex-1">{agentError}</span>
            <button onClick={() => setAgentError('')} className="hover:text-red-900">&times;</button>
          </div>
        )}

        <ChatInput onSend={handleSend} disabled={sending} />

        {/* Quick action chips below input bar */}
        <QuickChips onSelect={handleQuickChip} onDiaryOpen={handleDiaryOpen} disabled={sending} />
      </main>

      {/* New Chat Modal — pick buddy/personality before starting */}
      {newChatModalOpen && (
        <NewChatModal
          userId={userId}
          onConfirm={handleNewChatConfirm}
          onClose={() => setNewChatModalOpen(false)}
        />
      )}

      {/* Diary Modal */}
      {diaryModalOpen && (
        <DiaryModal
          userId={userId}
          onClose={() => setDiaryModalOpen(false)}
          onDiaryCreated={handleDiaryCreated}
        />
      )}
    </div>
  );
}

export default PersonalTravelAssistantPage;
