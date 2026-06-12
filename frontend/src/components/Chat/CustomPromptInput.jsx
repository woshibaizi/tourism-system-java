import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';

const PLACEHOLDER_EXAMPLES = [
  '用王家卫《重庆森林》的独白风格写...',
  '模仿鲁迅先生的文笔...',
  '像国家地理杂志的旅行文章...',
  '用海明威的极简风格叙事...',
  '写成古风诗词的感觉...',
];

export default function CustomPromptInput({ value, onChange }) {
  const [focused, setFocused] = useState(false);
  const [placeholder, setPlaceholder] = useState('');

  const handleFocus = () => {
    setFocused(true);
    const random = PLACEHOLDER_EXAMPLES[Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)];
    setPlaceholder(random);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={12} className="text-accent" />
        <p className="text-xs font-medium text-heading">自定义风格描述</p>
        <span className="text-[10px] text-muted">（优先级最高，覆盖以上所有参数）</span>
      </div>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        onFocus={handleFocus}
        onBlur={() => setFocused(false)}
        placeholder={focused ? `比如：${placeholder}` : '输入你想要的任何风格描述...'}
        rows={2}
        className={clsx(
          'w-full px-4 py-3 text-sm rounded-xl border transition-all resize-none placeholder:text-neutral-300',
          value
            ? 'border-accent bg-accent-soft/30 text-heading'
            : 'border-dashed border-neutral-200 focus:border-accent focus:bg-accent-soft/10 focus:ring-1 focus:ring-accent/20'
        )}
      />
      {value && (
        <button
          onClick={() => onChange(null)}
          className="absolute top-8 right-3 w-6 h-6 flex items-center justify-center rounded-full bg-neutral-200 hover:bg-neutral-300 transition-colors"
        >
          <X size={12} />
        </button>
      )}
      <p className="text-[10px] text-muted mt-1">
        此描述将直接作为 AI 的风格指令，优先级最高
      </p>
    </div>
  );
}

// inline clsx for this component only
function clsx(...args) {
  return args.filter(Boolean).join(' ');
}
