import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

/**
 * 途经点列表组件
 * @param {Array} waypoints - [{ id, value, label }]
 * @param {Function} onUpdate - (id, newValue) => void
 * @param {Function} onAdd - () => void
 * @param {Function} onRemove - (id) => void
 * @param {ReactNode} children - 渲染每个途经点的选择器组件
 * @param {boolean} showFixed - 是否显示固定复选框 (mixed模式)
 * @param {Function} onToggleFixed - (id) => void
 */
export default function WaypointList({
  waypoints = [],
  onAdd,
  onRemove,
  children,
  showFixed = false,
  onToggleFixed,
}) {
  if (!waypoints.length && !onAdd) return null;

  return (
    <div className="space-y-2.5">
      {waypoints.map((wp, index) => (
        <div key={wp.id} className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-blue-700">{index + 1}</span>
          </div>
          <div className="flex-1">
            {typeof children === 'function'
              ? children(wp, index)
              : children}
          </div>
          {showFixed && onToggleFixed && (
            <label className="flex items-center gap-1 text-xs text-muted shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={wp.fixed || false}
                onChange={() => onToggleFixed(wp.id)}
                className="w-3.5 h-3.5"
              />
              固定
            </label>
          )}
          {waypoints.length > 1 && onRemove && (
            <button
              onClick={() => onRemove(wp.id)}
              className="p-2 text-muted hover:text-red-500 transition-colors shrink-0"
              title="移除途经点"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      {onAdd && (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center shrink-0" />
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors py-2 px-3 border border-dashed border-neutral-300 hover:border-neutral-500 w-full justify-center"
          >
            <Plus size={14} /> 添加途经点
          </button>
        </div>
      )}
    </div>
  );
}
