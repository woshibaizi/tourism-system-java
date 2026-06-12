import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { X, User, Plus } from 'lucide-react';
import { getBuddies, createBuddy } from '../../services/api';

const BUDDY_DESC = {
  toxic_guide: '退休老导游，说话刻薄但推荐靠谱',
  literary_cat: '在西湖边活了三百年的猫，慵懒诗意',
  special_forces: '军事化指挥官，精确到分钟的行程',
  failed_poet: '什么都想赋诗一首，打油诗风格',
  shy_junior: '暗恋学长的学妹，校园视角叙事',
  beijing_laoye: '北京老大爷，京腔京韵自带相声感',
};

export default function NewChatModal({ userId, onConfirm, onClose }) {
  const [buddies, setBuddies] = useState([]);
  const [selected, setSelected] = useState(null); // null = default, string = buddy id
  const [customName, setCustomName] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getBuddies(userId);
        if (res.success) setBuddies(res.data || []);
      } catch { /* offline */ }
      setLoading(false);
    })();
  }, [userId]);

  const handleSelect = (buddyId) => {
    setSelected(buddyId === selected ? null : buddyId);
    setShowCustom(false);
  };

  const handleConfirm = async () => {
    if (showCustom && customName.trim()) {
      try {
        const res = await createBuddy({ userId, name: customName.trim() });
        if (res.success && res.data) {
          onConfirm(res.data.id, res.data.name);
          return;
        }
      } catch { /* fall through to use selected */ }
    }
    const buddy = buddies.find((b) => b.id === selected);
    onConfirm(selected, buddy ? buddy.name : null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md mx-4 shadow-2xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-serif text-lg text-heading">新对话</h2>
          <button onClick={onClose} className="text-muted hover:text-heading"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="font-sans text-sm text-muted">选择一个旅行搭子，或直接开始</p>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {/* Default option */}
              <button
                onClick={() => { setSelected(null); setShowCustom(false); }}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border text-left transition-colors',
                  selected === null && !showCustom
                    ? 'border-accent bg-accent-soft'
                    : 'border-border hover:border-accent'
                )}
              >
                <User size={20} className="text-muted" />
                <span className="text-xs font-medium text-heading">默认模式</span>
                <span className="text-[10px] text-muted">无特定人格</span>
              </button>

              {/* Preset buddies */}
              {buddies.filter((b) => b.isPreset).map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelect(b.id)}
                  className={clsx(
                    'flex flex-col items-center gap-2 p-3 border text-left transition-colors',
                    selected === b.id
                      ? 'border-accent bg-accent-soft'
                      : 'border-border hover:border-accent'
                  )}
                >
                  <User size={20} className={selected === b.id ? 'text-accent' : 'text-muted'} />
                  <span className="text-xs font-medium text-heading">{b.name}</span>
                  <span className="text-[10px] text-muted leading-tight text-center">
                    {BUDDY_DESC[b.id] || b.personality?.slice(0, 30) || ''}
                  </span>
                </button>
              ))}

              {/* Custom buddy */}
              <button
                onClick={() => { setShowCustom(!showCustom); setSelected(null); }}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 border text-left transition-colors',
                  showCustom ? 'border-accent bg-accent-soft' : 'border-border hover:border-accent'
                )}
              >
                <Plus size={20} className="text-muted" />
                <span className="text-xs font-medium text-heading">自定义</span>
                <span className="text-[10px] text-muted">创建专属搭子</span>
              </button>
            </div>
          )}

          {showCustom && (
            <input
              autoFocus
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder="给你的搭子起个名字..."
              className="w-full px-3 py-2 text-sm border border-border focus:outline-none focus:border-accent"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-muted hover:text-heading border border-border"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 bg-heading text-white text-sm hover:opacity-90"
          >
            开始对话
          </button>
        </div>
      </div>
    </div>
  );
}
