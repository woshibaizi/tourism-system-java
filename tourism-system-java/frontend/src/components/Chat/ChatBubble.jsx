import React from 'react';
import { clsx } from 'clsx';
import { User, Bot } from 'lucide-react';

export default function ChatBubble({ message, className }) {
  const isUser = message.role === 'user';

  return (
    <div className={clsx('flex gap-3 mb-6', isUser ? 'justify-end' : 'justify-start', className)}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
          <Bot size={16} className="text-neutral-500" />
        </div>
      )}
      <div
        className={clsx(
          'max-w-[75%] px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-black text-white rounded-bl-lg rounded-br-sm rounded-tl-lg rounded-tr-lg'
            : 'bg-neutral-50 text-body border border-neutral-100 rounded-bl-sm rounded-br-lg rounded-tl-sm rounded-tr-lg'
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.createdAt && (
          <span className={clsx('text-[10px] mt-1 block', isUser ? 'text-white/60' : 'text-muted')}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center flex-shrink-0">
          <User size={14} className="text-white" />
        </div>
      )}
    </div>
  );
}
