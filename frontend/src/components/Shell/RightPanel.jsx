import React from 'react';
import { User, MapPin, Calendar, Star } from 'lucide-react';
import { clsx } from 'clsx';

export default function RightPanel({ currentUser, onLogout, className }) {
  const interests = currentUser?.interests || [];
  const favoriteCategories = currentUser?.favoriteCategories || [];

  return (
    <aside
      className={clsx(
        'w-72 py-12 px-8 h-screen sticky top-0 border-l border-neutral-100 bg-white',
        className
      )}
    >
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
          <User size={28} className="text-neutral-400" />
        </div>
        <h3 className="font-serif text-lg text-heading">
          {currentUser?.username || currentUser?.name || '旅行者'}
        </h3>
        <p className="font-sans text-xs text-muted mt-1">Travel Explorer</p>
      </div>

      {interests.length > 0 && (
        <div className="mb-6">
          <h4 className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted font-medium mb-3">
            Interests
          </h4>
          <div className="flex flex-wrap gap-2">
            {interests.map((item) => (
              <span
                key={item}
                className="px-3 py-1 text-xs bg-neutral-50 border border-neutral-200 text-neutral-600"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {favoriteCategories.length > 0 && (
        <div className="mb-6">
          <h4 className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted font-medium mb-3">
            Favorites
          </h4>
          <div className="flex flex-wrap gap-2">
            {favoriteCategories.map((item) => (
              <span
                key={item}
                className="px-3 py-1 text-xs bg-neutral-50 border border-neutral-200 text-neutral-600"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-neutral-100 pt-6 space-y-3">
        <div className="flex items-center gap-3 text-sm text-muted">
          <MapPin size={14} />
          <span>Recent views</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <Calendar size={14} />
          <span>Travel plans</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <Star size={14} />
          <span>Saved places</span>
        </div>
      </div>

      <button
        onClick={onLogout}
        className="w-full mt-8 py-3 border border-neutral-200 text-neutral-500 font-sans text-xs uppercase tracking-widest hover:border-neutral-900 hover:text-neutral-900 transition-colors"
      >
        Sign Out
      </button>
    </aside>
  );
}
