import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Avatar, Button, Input, Spin, Typography } from 'antd';
import {
  ArrowUpOutlined,
  HistoryOutlined,
  MessageOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { chatWithAgent, getAgentHealth, getAgentSessions } from '../services/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

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

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || sending) return;

    const userMsg = { role: 'user', content: text, createdAt: new Date().toISOString() };
    setMessages((p) => [...p, userMsg]);
    setInputValue('');
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

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setInputValue('');
    setAgentError('');
  };

  const handleSelectSession = (id) => {
    setSessionId(id);
    const found = sessions.find((s) => s.sessionId === id);
    if (found?.messages) {
      setMessages(found.messages);
    } else {
      setMessages([]);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin /></div>;
  }

  const userName = currentUser?.username || currentUser?.name || '游客';

  return (
    <div className="assistant-layout">
      {/* ====== SIDEBAR ====== */}
      <aside className="assistant-sidebar">
        {/* user info */}
        <div className="assistant-sidebar-user">
          <Avatar size={40} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff', flexShrink: 0 }} />
          <div className="assistant-sidebar-user-text">
            <Text strong style={{ fontSize: 14 }}>{userName}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>旅游助手</Text>
          </div>
        </div>

        {/* new chat */}
        <Button
          type="primary"
          block
          icon={<PlusOutlined />}
          onClick={handleNewChat}
          style={{ marginBottom: 16, borderRadius: 8 }}
        >
          新对话
        </Button>

        {/* agent status */}
        <div className="assistant-agent-status">
          <span className={`assistant-dot ${agentOnline ? 'online' : ''}`} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {agentOnline ? '助手在线' : '未连接'}
          </Text>
        </div>

        {/* divider */}
        <div className="assistant-sidebar-divider" />

        {/* history sessions */}
        <div className="assistant-session-list">
          <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, padding: '0 0 8px', display: 'block' }}>
            历史对话
          </Text>
          {sessions.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>暂无历史对话</Text>
          ) : (
            sessions.slice(0, 20).map((s) => (
              <div
                key={s.sessionId}
                className={`assistant-session-item ${s.sessionId === sessionId ? 'active' : ''}`}
                onClick={() => handleSelectSession(s.sessionId)}
              >
                <HistoryOutlined style={{ fontSize: 13, color: '#999', flexShrink: 0 }} />
                <div className="assistant-session-item-text">
                  <span className="assistant-session-title">{(s.title || s.preview || '新对话').slice(0, 18)}</span>
                  <span className="assistant-session-time">{s.updatedAt ? formatTime(s.updatedAt) : ''}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ====== DIVIDER ====== */}
      <div className="assistant-divider" />

      {/* ====== CHAT AREA ====== */}
      <main className="assistant-chat">
        {/* messages */}
        <div className="assistant-messages">
          {messages.length === 0 ? (
            <div className="assistant-empty">
              <MessageOutlined style={{ fontSize: 40, color: '#d9d9d9', marginBottom: 16 }} />
              <Paragraph type="secondary">输入旅行问题，例如：推荐杭州一日游路线</Paragraph>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={`assistant-bubble-row ${m.role === 'user' ? 'is-user' : 'is-assistant'}`}>
                {m.role === 'assistant' && <span className="assistant-role-tag">AI</span>}
                <div className={`assistant-bubble ${m.role}`}>
                  <div className="assistant-bubble-content">{m.content}</div>
                  <div className="assistant-bubble-time">{formatTime(m.createdAt)}</div>
                </div>
                {m.role === 'user' && <span className="assistant-role-tag user">Me</span>}
              </div>
            ))
          )}
          {/* AI thinking spinner */}
          {sending && (
            <div className="assistant-bubble-row is-assistant">
              <span className="assistant-role-tag">AI</span>
              <div className="assistant-bubble assistant">
                <div className="assistant-thinking">
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                  <span className="thinking-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={msgEndRef} />
        </div>

        {/* error */}
        {agentError && (
          <Alert type="warning" message={agentError} showIcon closable onClose={() => setAgentError('')} style={{ margin: '0 16px 8px', flexShrink: 0 }} />
        )}

        {/* input */}
        <div className="assistant-composer">
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送…"
            autoSize={{ minRows: 2, maxRows: 5 }}
            disabled={sending}
            style={{ borderRadius: 12, resize: 'none' }}
          />
          <Button
            type="primary"
            shape="circle"
            icon={<ArrowUpOutlined />}
            loading={sending}
            onClick={handleSend}
            style={{ flexShrink: 0, marginLeft: 10 }}
            size="large"
          />
        </div>
      </main>
    </div>
  );
}

export default PersonalTravelAssistantPage;
