import React from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';

const TONES = [
  { key: '活泼', emoji: '🎉' },
  { key: '文艺', emoji: '🌸' },
  { key: '幽默', emoji: '😄' },
  { key: '毒舌', emoji: '🔥' },
  { key: '温暖', emoji: '☀️' },
  { key: '冷静', emoji: '🧊' },
  { key: '热血', emoji: '⚡' },
  { key: '随性', emoji: '🍃' },
];

const LENGTHS = [
  { key: 'short', label: '短帖', desc: '~150字' },
  { key: 'medium', label: '中篇', desc: '~400字' },
  { key: 'long', label: '长文', desc: '~800字' },
];

const EMOJI_DENSITIES = [
  { key: 'none', label: '无' },
  { key: 'low', label: '少量' },
  { key: 'medium', label: '适中' },
  { key: 'high', label: '大量' },
];

const PARAGRAPH_STYLES = [
  { key: 'short', label: '短句分段' },
  { key: 'normal', label: '正常段落' },
  { key: 'flow', label: '流畅叙事' },
];

const PERSONS = [
  { key: 'first', label: '我 (第一人称)' },
  { key: 'second', label: '你 (第二人称)' },
  { key: 'third', label: 'TA (第三人称)' },
];

const FOCUS_AREAS = [
  { key: '风景', emoji: '🏔️' },
  { key: '美食', emoji: '🍜' },
  { key: '人文', emoji: '📚' },
  { key: '打卡', emoji: '📍' },
  { key: '攻略', emoji: '📝' },
];

export default function StyleTuner({ profile, onChange, defaultExpanded = false, disabled = false }) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  const update = (field, value) => {
    if (disabled) return;
    onChange({ ...profile, [field]: value });
  };

  const toggleFocus = (key) => {
    const current = profile.focusOn || [];
    const next = current.includes(key)
      ? current.filter((f) => f !== key)
      : [...current, key];
    update('focusOn', next.length > 0 ? next : null);
  };

  const activeCount = Object.values(profile).filter((v) => v != null && v !== false).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-heading">
          <Settings2 size={14} />
          高级调参
          {activeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-accent-soft text-accent rounded-full font-medium">
              {activeCount}项
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          {/* 语气 */}
          <div>
            <p className="text-xs font-medium text-heading mb-2">语气</p>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => update('tone', profile.tone === t.key ? null : t.key)}
                  className={clsx(
                    'px-2.5 py-1.5 rounded-lg text-xs border transition-all',
                    profile.tone === t.key
                      ? 'border-accent bg-accent-soft text-heading font-semibold'
                      : 'border-border text-muted hover:border-accent'
                  )}
                >
                  {t.emoji} {t.key}
                </button>
              ))}
            </div>
          </div>

          {/* 篇幅 */}
          <div>
            <p className="text-xs font-medium text-heading mb-2">篇幅</p>
            <div className="flex gap-1.5">
              {LENGTHS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => update('length', profile.length === l.key ? null : l.key)}
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-xs border transition-all text-center',
                    profile.length === l.key
                      ? 'border-accent bg-accent-soft text-heading font-semibold'
                      : 'border-border text-muted hover:border-accent'
                  )}
                >
                  <span className="block text-sm font-medium">{l.label}</span>
                  <span className="text-[10px] opacity-60">{l.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Emoji 密度 */}
          <div>
            <p className="text-xs font-medium text-heading mb-2">Emoji 密度</p>
            <div className="flex gap-1.5">
              {EMOJI_DENSITIES.map((e) => (
                <button
                  key={e.key}
                  onClick={() => update('emojiDensity', profile.emojiDensity === e.key ? null : e.key)}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-xs border transition-all text-center',
                    profile.emojiDensity === e.key
                      ? 'border-accent bg-accent-soft text-heading font-semibold'
                      : 'border-border text-muted hover:border-accent'
                  )}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* 段落风格 + 人称视角 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-heading mb-2">段落风格</p>
              <div className="space-y-1">
                {PARAGRAPH_STYLES.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => update('paragraphStyle', profile.paragraphStyle === p.key ? null : p.key)}
                    className={clsx(
                      'w-full py-1.5 rounded-lg text-xs border transition-all text-center',
                      profile.paragraphStyle === p.key
                        ? 'border-accent bg-accent-soft text-heading font-semibold'
                        : 'border-border text-muted hover:border-accent'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-heading mb-2">人称视角</p>
              <div className="space-y-1">
                {PERSONS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => update('person', profile.person === p.key ? null : p.key)}
                    className={clsx(
                      'w-full py-1.5 rounded-lg text-xs border transition-all text-center',
                      profile.person === p.key
                        ? 'border-accent bg-accent-soft text-heading font-semibold'
                        : 'border-border text-muted hover:border-accent'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 内容侧重 */}
          <div>
            <p className="text-xs font-medium text-heading mb-2">内容侧重 (多选)</p>
            <div className="flex flex-wrap gap-1.5">
              {FOCUS_AREAS.map((f) => {
                const active = (profile.focusOn || []).includes(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleFocus(f.key)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs border transition-all',
                      active
                        ? 'border-accent bg-accent-soft text-heading font-semibold'
                        : 'border-border text-muted hover:border-accent'
                    )}
                  >
                    {f.emoji} {f.key}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 话题标签数 */}
          <div>
            <p className="text-xs font-medium text-heading mb-2">
              话题标签: <span className="text-accent font-bold">{profile.hashtagCount ?? '默认'}</span>
            </p>
            <input
              type="range"
              min={0}
              max={10}
              value={profile.hashtagCount ?? 5}
              onChange={(e) => update('hashtagCount', Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-neutral-200 accent-accent cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>0 (无标签)</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          {/* 搭子风格 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={profile.useBuddy || false}
              onChange={(e) => update('useBuddy', e.target.checked || null)}
              className="w-4 h-4 rounded accent-accent"
            />
            <span className="text-xs text-heading font-medium">🎭 用出游搭子的人格风格写游记</span>
          </label>

          {/* 重置 */}
          <button
            onClick={() => onChange({})}
            className="w-full py-2 text-xs text-muted hover:text-heading border border-border rounded-lg transition-colors"
          >
            重置所有参数
          </button>
        </div>
      )}
    </div>
  );
}
