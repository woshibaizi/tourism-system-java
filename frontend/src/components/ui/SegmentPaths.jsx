import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Footprints, Timer } from 'lucide-react';

const fmtDist = (m) => {
  if (m == null) return '--';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
};

const fmtTime = (t) => {
  if (t == null) return '--';
  const mins = typeof t === 'number' && t < 10 ? t : Math.round(Number(t));
  return `${mins} min`;
};

/**
 * 分段路径展示：显示 A→B, B→C, C→D 每段独立卡片
 */
export default function SegmentPaths({ segments = [], nodes = [], formatNodeName, path = [] }) {
  if (!segments || segments.length === 0) return null;

  const nameOf = (id) => {
    if (formatNodeName) return formatNodeName(id);
    const n = nodes.find((x) => x.id === id);
    if (n) return n.name;
    return id;
  };

  return (
    <div className="border border-border">
      <div className="px-5 py-3 border-b border-border">
        <h3 className="font-sans text-xs tracking-wide text-muted">路径分段</h3>
      </div>
      <div className="divide-y divide-border">
        {segments.map((seg, i) => {
          const fromName = seg.fromRoomName || nameOf(seg.from) || `起点`;
          const toName = seg.toRoomName || nameOf(seg.to) || `终点`;

          return (
            <SegmentCard
              key={i}
              index={i}
              fromName={fromName}
              toName={toName}
              distance={seg.distance}
              time={seg.estimatedTime ?? seg.time}
              steps={seg.steps}
              floorChange={seg.floorChange}
              total={segments.length}
            />
          );
        })}
      </div>
    </div>
  );
}

function SegmentCard({ index, fromName, toName, distance, time, steps, floorChange, total }) {
  const [expanded, setExpanded] = useState(false);
  const hasSteps = steps && steps.length > 0;

  return (
    <div className="px-5 py-3.5">
      {/* 头部 */}
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => hasSteps && setExpanded(!expanded)}
      >
        {/* 段序号 */}
        <div className="w-7 h-7 rounded-full bg-heading/10 flex items-center justify-center shrink-0">
          <span className="font-mono text-xs font-medium text-heading">{index + 1}</span>
        </div>

        {/* 路径 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="font-sans text-sm font-medium text-heading truncate max-w-[140px]">
              {fromName}
            </span>
            <span className="text-muted text-xs shrink-0">→</span>
            <span className="font-sans text-sm font-medium text-heading truncate max-w-[140px]">
              {toName}
            </span>
          </div>
          {floorChange && (
            <p className="text-xs text-muted mt-0.5">含楼层切换</p>
          )}
        </div>

        {/* 距离 & 时间 */}
        <div className="flex items-center gap-3 text-xs text-muted shrink-0 ml-auto">
          <span className="flex items-center gap-1">
            <Footprints size={12} />
            {fmtDist(distance)}
          </span>
          <span className="flex items-center gap-1">
            <Timer size={12} />
            {fmtTime(time)}
          </span>
        </div>

        {/* 展开箭头 */}
        {hasSteps && (
          <span className="text-muted shrink-0">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
      </div>

      {/* 展开: 子步骤 */}
      {expanded && hasSteps && (
        <div className="mt-3 ml-10 space-y-1.5 border-l-2 border-neutral-100 pl-4">
          {steps.map((step, si) => (
            <div key={si} className="flex items-start gap-2 text-xs text-body">
              <span className="text-muted font-mono w-5 shrink-0">{si + 1}.</span>
              <span className="leading-relaxed">
                {step.action || step.instruction || step.description || `第${si + 1}步`}
              </span>
              {step.distance > 0 && (
                <span className="text-muted shrink-0 ml-auto">{fmtDist(step.distance)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
