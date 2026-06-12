import React, { useEffect, useState, useRef } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, Plus, User, X } from 'lucide-react';
import { getBuddies, createBuddy, deleteBuddy } from '../../services/api';

export default function BuddySelector({ userId, selectedId, onSelect, className }) {
  const [buddies, setBuddies] = useState([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    loadBuddies();
  }, [userId]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadBuddies = async () => {
    try {
      const res = await getBuddies(userId);
      if (res.success) setBuddies(res.data || []);
    } catch { /* offline */ }
    setLoading(false);
  };

  const selected = buddies.find((b) => b.id === selectedId);
  const displayName = selected ? selected.name : '选择搭子';

  const handleSelect = (buddy) => {
    onSelect(buddy.id);
    setOpen(false);
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const res = await createBuddy({ userId, name });
      if (res.success && res.data) {
        setBuddies((prev) => [...prev, res.data]);
        onSelect(res.data.id);
      }
    } catch { /* ignore */ }
    setNewName('');
    setAdding(false);
  };

  const handleDelete = async (e, buddyId) => {
    e.stopPropagation();
    if (buddies.find((b) => b.id === buddyId)?.isPreset) return;
    try {
      await deleteBuddy(buddyId, userId);
      setBuddies((prev) => prev.filter((b) => b.id !== buddyId));
      if (selectedId === buddyId) onSelect(null);
    } catch { /* ignore */ }
  };

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center justify-between w-full px-3 py-2 text-xs text-muted hover:text-heading border border-border bg-surface transition-colors"
      >
        <span className="truncate">{loading ? '加载中...' : displayName}</span>
        <ChevronDown size={12} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border shadow-lg z-30 max-h-56 overflow-y-auto">
          {buddies.map((b) => (
            <button
              key={b.id}
              onClick={() => handleSelect(b)}
              className={clsx(
                'flex items-center justify-between w-full px-3 py-2 text-xs text-left hover:bg-accent-soft transition-colors',
                b.id === selectedId ? 'bg-accent-soft text-heading font-medium' : 'text-muted'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <User size={12} className="flex-shrink-0" />
                <span className="truncate">{b.name}</span>
                {b.isPreset && (
                  <span className="text-[9px] px-1 bg-accent-soft border border-border rounded flex-shrink-0">预设</span>
                )}
              </div>
              {!b.isPreset && (
                <button onClick={(e) => handleDelete(e, b.id)} className="text-muted hover:text-red-500 ml-2 flex-shrink-0">
                  <X size={10} />
                </button>
              )}
            </button>
          ))}

          {adding ? (
            <div className="flex gap-1 px-2 py-1.5 border-t border-border">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
                placeholder="搭子名称..."
                className="flex-1 text-xs px-2 py-1 border border-border focus:outline-none focus:border-accent"
              />
              <button onClick={handleAdd} className="text-xs px-2 py-1 bg-heading text-white hover:bg-neutral-800">
                确定
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 w-full px-3 py-2 text-xs text-muted hover:text-heading hover:bg-accent-soft transition-colors border-t border-border"
            >
              <Plus size={10} /> 自定义搭子
            </button>
          )}
        </div>
      )}
    </div>
  );
}
