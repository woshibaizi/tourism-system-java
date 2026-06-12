import React from 'react';
import { Layers } from 'lucide-react';

const fmtDist = (m) => {
  if (m == null) return '--';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
};

const fmtTime = (t) => {
  if (t == null) return '--';
  if (typeof t === 'number' && t < 10) return `${t.toFixed(1)} min`;
  return `${Math.round(t)} min`;
};

/**
 * 路线摘要卡片
 */
export default function RouteSummary({ result, nodes = [], formatNodeName }) {
  if (!result) return null;

  const nameOf = (id) => {
    if (formatNodeName) return formatNodeName(id);
    const n = nodes.find((x) => x.id === id);
    return n ? n.name : id;
  };

  return (
    <div className="border border-border p-6 space-y-5">
      {/* 总览数据 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-xs text-muted tracking-wide">总距离</span>
          <p className="font-serif text-lg text-heading mt-0.5">
            {fmtDist(result.totalDistance)}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted tracking-wide">总时间</span>
          <p className="font-serif text-lg text-heading mt-0.5">
            {fmtTime(result.totalTime ?? result.totalEstimatedTimeMinutes ?? result.estimatedTimeMinutes)}
          </p>
        </div>
        {result.mode && (
          <div>
            <span className="text-xs text-muted tracking-wide">模式</span>
            <p className="font-serif text-lg text-heading mt-0.5">{result.mode}</p>
          </div>
        )}
        {result.waypointCount != null && (
          <div>
            <span className="text-xs text-muted tracking-wide">途经点</span>
            <p className="font-serif text-lg text-heading mt-0.5">{result.waypointCount} 个</p>
          </div>
        )}
      </div>

      {/* 楼层分析 (室内模式) */}
      {(result.totalFloorAnalysis || result.floorAnalysis) && (
        <div className="text-xs text-muted space-y-1 border-t border-border pt-4">
          {(() => {
            const fa = result.totalFloorAnalysis || result.floorAnalysis;
            const fc = fa.totalFloorChanges != null ? fa.totalFloorChanges : fa.floorChanges;
            return (
              <p>
                楼层变化: {fc || 0} 次 (电梯: {fa.elevatorChanges || 0}, 楼梯: {fa.stairChanges || 0})
                {fa.floorsVisited?.length > 0 && ` · 经过楼层: ${fa.floorsVisited.join(', ')}`}
              </p>
            );
          })()}
        </div>
      )}

      {/* 最优访问顺序 */}
      {result.targetPath && result.targetPath.length > 0 && (
        <div className="border-t border-border pt-4">
          <span className="text-xs text-muted tracking-wide">最优访问顺序</span>
          <p className="text-sm font-mono text-body mt-1">
            {result.targetPath.map((id) => nameOf(id)).join(' → ')}
          </p>
        </div>
      )}

      {/* 房间访问列表 (室内多房间) */}
      {result.roomsVisited && result.roomsVisited.length > 0 && (
        <div className="border-t border-border pt-4">
          <span className="text-xs text-muted tracking-wide">访问房间</span>
          <p className="text-sm text-body mt-1">
            {result.roomsVisited.map((r) => r.name || r.id).join(' → ')}
          </p>
        </div>
      )}
    </div>
  );
}
