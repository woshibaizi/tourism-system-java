import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, History, MessageCircle, Plus, User, Trash2 } from 'lucide-react';
import { chatWithAgent, getAgentHealth, getAgentSession, getAgentSessions } from '../services/api';
import api from '../services/api';
import ChatBubble from '../components/Chat/ChatBubble';
import ChatInput from '../components/Chat/ChatInput';
import TypingIndicator from '../components/Chat/TypingIndicator';

const formatTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

function PersonalTravelAssistantPage() {
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [agentOnline, setAgentOnline] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const msgEndRef = useRef(null);

  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [h, s] = await Promise.allSettled([getAgentHealth(), getAgentSessions()]);
        if (h.status === 'fulfilled' && h.value.success) {
          setAgentOnline(h.value.data?.status === 'ok');
        }
        if (s.status === 'fulfilled' && s.value.success) {
          const list = s.value.data || [];
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

  const handleSend = async (text) => {
    if (!text || sending) return;

    const userMsg = { role: 'user', content: text, createdAt: new Date().toISOString() };
    setMessages((p) => [...p, userMsg]);
    setSending(true);
    setAgentError('');

    try {
      const res = await chatWithAgent({ sessionId, message: text, metadata: { entry: 'web' } });
      if (!res.success) {
        setMessages((p) => p.filter((m) => m !== userMsg));
        setAgentError(res.message || '发送失败');
        setSending(false);
        return;
      }
      const s = res.data.session;
      setSessionId(s.sessionId);
      setMessages(s.messages || []);
      mergeSession(s);
    } catch {
      setMessages((p) => p.filter((m) => m !== userMsg));
      setAgentError('消息发送失败，请确认服务已启动');
    } finally {
      setSending(false);
    }
  };

  const mergeSession = (s) => {
    if (!s?.sessionId) return;
    setSessions((p) => [s, ...p.filter((i) => i.sessionId !== s.sessionId)]);
  };

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setAgentError('');
  };

  const handleSelectSession = async (id) => {
    if (id === sessionId) return;
    setSessionId(id);
    setSessionLoading(true);
    try {
      const res = await getAgentSession(id);
      if (res.success && res.data) {
        setMessages(res.data.messages || []);
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
      await api.delete(`/agent/sessions/${id}`, { params: { user_id: currentUser?.id || 'anonymous' } });
      setSessions((p) => p.filter((s) => s.sessionId !== id));
      if (sessionId === id) {
        setSessionId(null);
        setMessages([]);
      }
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  const userName = currentUser?.username || currentUser?.name || '游客';

  return (
    <div className="flex h-[calc(100vh-0px)] md:min-h-0">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-72 border-r border-neutral-100 bg-white flex-shrink-0">
        <div className="p-4 border-b border-neutral-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
              <User size={20} className="text-neutral-400" />
            </div>
            <div>
              <p className="font-sans text-sm text-heading font-medium">{userName}</p>
              <p className="font-sans text-xs text-muted">旅游助手</p>
            </div>
          </div>
          <button
            onClick={handleNewChat}
            className="w-full py-2.5 bg-black text-white text-xs uppercase tracking-widest font-sans hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={14} /> 新对话
          </button>
        </div>

        <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${agentOnline ? 'bg-green-500' : 'bg-neutral-300'}`} />
          <span className="font-sans text-xs text-muted">{agentOnline ? '助手在线' : '未连接'}</span>
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
                className={`group flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                  s.sessionId === sessionId
                    ? 'bg-neutral-100 text-heading'
                    : 'text-muted hover:bg-neutral-50 hover:text-heading'
                }`}
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
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {sessionLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle size={40} className="text-neutral-200 mb-4" />
              <p className="font-sans text-sm text-muted">输入旅行问题，例如：推荐杭州一日游路线</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <ChatBubble key={`${m.role}-${i}`} message={m} />
            ))
          )}
          {sending && <TypingIndicator />}
          <div ref={msgEndRef} />
        </div>

        {agentError && (
          <div className="mx-4 mb-2 flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <AlertCircle size={14} />
            <span className="flex-1">{agentError}</span>
            <button onClick={() => setAgentError('')} className="text-amber-600 hover:text-amber-800">&times;</button>
          </div>
        )}

        <ChatInput onSend={handleSend} disabled={sending} />
      </main>
    </div>
  );
}

export default PersonalTravelAssistantPage;
