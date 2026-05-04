import { AnimatePresence, motion } from 'framer-motion';
import { Bot, BrainCircuit, Sparkles, TriangleAlert } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentMessage } from '../../types/api';

interface ChatStreamProps {
  messages: AgentMessage[];
  connectionState: 'idle' | 'connected' | 'offline';
}

const roleTone: Record<string, string> = {
  pm: 'from-indigo-500/20 to-indigo-500/5 text-indigo-700 dark:text-indigo-200',
  architect: 'from-sky-500/20 to-sky-500/5 text-sky-700 dark:text-sky-200',
  developer: 'from-emerald-500/20 to-emerald-500/5 text-emerald-700 dark:text-emerald-200',
  qa: 'from-amber-500/20 to-amber-500/5 text-amber-700 dark:text-amber-200',
  mentor: 'from-pink-500/20 to-pink-500/5 text-pink-700 dark:text-pink-200',
  system: 'from-slate-500/20 to-slate-500/5 text-slate-700 dark:text-slate-200',
};

export function ChatStream({ messages, connectionState }: ChatStreamProps) {
  return (
    <div className="flex h-full min-h-0 flex-col space-y-4">
      <div className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/70 px-4 py-3 dark:bg-white/5">
        <div>
          <div className="text-sm font-semibold text-slate-950 dark:text-white">Agent 对话流</div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            查看各个角色的分析、产出与交接过程
          </p>
        </div>
        <span className={`status-pill ${connectionState === 'connected' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'}`}>
          <Sparkles className="h-3.5 w-3.5" />
          {connectionState === 'connected' ? 'WS 已连接' : '等待数据'}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {messages.length > 0 ? (
            messages.map((message, index) => {
              const tone = roleTone[message.agent_role] ?? roleTone.system;
              const Icon =
                message.msg_type === 'thinking'
                  ? BrainCircuit
                  : message.msg_type === 'error'
                    ? TriangleAlert
                    : Bot;

              return (
                <motion.article
                  key={`${message.agent_role}-${message.stage}-${index}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.22 }}
                  className="glass-panel rounded-[28px] p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-sm font-semibold text-slate-950 dark:text-white">
                          {message.agent_name}
                        </div>
                        <span className="rounded-full bg-slate-900/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                          {message.stage}
                        </span>
                        <span className="rounded-full bg-slate-900/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                          {message.msg_type}
                        </span>
                      </div>

                      <div className="markdown-body prose prose-slate mt-4 max-w-none text-sm leading-7 dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel rounded-[28px] p-8 text-center text-sm leading-7 text-slate-500 dark:text-slate-400"
            >
              创建项目后，这里会出现各个 Agent 的思考、产出和交接记录。
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
