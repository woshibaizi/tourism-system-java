import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * 通用分页器 — 防数字过多，自动折叠中间页码
 *
 * 规则：
 * - 总页数 ≤ 7：全部显示
 * - 总页数 > 7：显示首尾 + 当前附近 + 省略号
 *
 * 示例：[1] [2] [3] ... [7] [8] [9]
 *       [1] ... [4] [5] [6] ... [9]
 */
export default function Pagination({ current, total, onChange }) {
  if (total <= 1) return null;

  const btnBase =
    'w-8 h-8 flex items-center justify-center text-xs font-sans border rounded transition-colors';
  const btnActive = 'bg-heading text-white border-heading';
  const btnInactive = 'border-border text-muted hover:text-heading hover:border-heading';
  const btnDisabled = 'border-border text-muted/30 cursor-not-allowed';

  const pages = getPages(current, total);

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      {/* Prev */}
      <button
        disabled={current <= 1}
        onClick={() => current > 1 && onChange(current - 1)}
        className={`${btnBase} ${current <= 1 ? btnDisabled : btnInactive}`}
        aria-label="上一页"
      >
        <ChevronLeft size={14} />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`${btnBase} ${p === current ? btnActive : btnInactive}`}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        disabled={current >= total}
        onClick={() => current < total && onChange(current + 1)}
        className={`${btnBase} ${current >= total ? btnDisabled : btnInactive}`}
        aria-label="下一页"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function getPages(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [];

  // Always include page 1
  pages.push(1);

  if (current > 3) {
    pages.push('...');
  }

  // Pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push('...');
  }

  // Always include last page
  pages.push(total);

  return pages;
}
