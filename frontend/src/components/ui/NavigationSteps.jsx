import React from 'react';
import { Layers } from 'lucide-react';

const fmtDist = (m) => {
  if (m == null) return '';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
};

/**
 * 导航步骤列表
 */
export default function NavigationSteps({ steps = [], max = 20 }) {
  if (!steps || steps.length === 0) return null;

  const displayed = steps.slice(0, max);

  return (
    <div className="space-y-2.5">
      {displayed.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-6 h-6 flex items-center justify-center border border-neutral-300 rounded-full flex-shrink-0">
            <span className="font-mono text-xs text-muted">{i + 1}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-sans text-sm text-body leading-relaxed">
              {step.action || step.instruction || step.description || `第${i + 1}步`}
            </p>
            {(step.distance > 0 || step.floorChange) && (
              <span className="inline-flex items-center gap-1 mt-0.5 font-sans text-xs text-muted">
                {step.distance > 0 && fmtDist(step.distance)}
                {step.floorChange && (
                  <span className="inline-flex items-center gap-0.5">
                    {step.distance > 0 && ' · '}
                    <Layers size={10} />
                    楼层切换
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
      ))}
      {steps.length > max && (
        <p className="text-xs text-muted text-center pt-2">
          还有 {steps.length - max} 步未显示
        </p>
      )}
    </div>
  );
}
