import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { clsx } from 'clsx';

export default function ChatInput({ onSend, disabled, placeholder = '输入您的问题...' }) {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-3 p-4 border-t border-neutral-100 bg-white">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={clsx(
          'flex-1 resize-none bg-transparent border-0 py-3 px-0 font-sans text-sm',
          'focus:ring-0 focus:outline-none placeholder:text-muted',
          'border-b border-neutral-200 focus:border-neutral-900 transition-colors'
        )}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className={clsx(
          'p-3 rounded-sm transition-colors flex-shrink-0',
          value.trim() && !disabled
            ? 'bg-black text-white hover:bg-neutral-800'
            : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
        )}
      >
        <Send size={16} />
      </button>
    </div>
  );
}
