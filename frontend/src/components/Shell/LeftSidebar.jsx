import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Home, MapPin, BookOpen, Map, Navigation,
  MessageCircle, BarChart3, LogOut, User,
} from 'lucide-react';
import { NAV_ITEMS } from '../../utils/constants';

const iconMap = { Home, MapPin, BookOpen, Map, Navigation, MessageCircle, BarChart3 };

export default function LeftSidebar({ currentUser, onLogout, className }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      className={clsx(
        'flex flex-col h-screen fixed left-0 top-0 z-40 bg-white border-r border-neutral-100',
        'w-64 py-12',
        'max-md:hidden',
        className
      )}
    >
      <div className="px-8 mb-12">
        <div className="font-serif text-2xl tracking-[0.2em] font-light text-neutral-900">
          VOYAGE
        </div>
        <div className="font-serif tracking-widest uppercase text-xs mt-2 text-neutral-400">
          EXPLORE
        </div>
      </div>

      <ul className="flex-1 flex flex-col gap-2 px-4">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon] || MapPin;
          const isActive = location.pathname === item.path;
          return (
            <li key={item.key}>
              <button
                onClick={() => navigate(item.path)}
                className={clsx(
                  'relative flex items-center gap-4 w-full py-3 px-4 font-serif tracking-widest uppercase text-xs transition-colors duration-300',
                  isActive
                    ? 'text-neutral-900 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-900'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-neutral-900"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="px-8 mt-auto space-y-6">
        <ul className="space-y-4">
          <li>
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-4 text-neutral-400 hover:text-neutral-900 transition-colors duration-300 w-full"
            >
              <User size={18} />
              <span className="font-serif tracking-widest uppercase text-xs">
                {currentUser?.username || 'Profile'}
              </span>
            </button>
          </li>
          <li>
            <button
              onClick={onLogout}
              className="flex items-center gap-4 text-neutral-400 hover:text-neutral-900 transition-colors duration-300 w-full"
            >
              <LogOut size={18} />
              <span className="font-serif tracking-widest uppercase text-xs">Logout</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
