import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { X, Home, MapPin, BookOpen, Map, Navigation, MessageCircle, BarChart3, User, LogOut } from 'lucide-react';
import { NAV_ITEMS } from '../../utils/constants';
import LogoText from '../ui/LogoText';

const iconMap = { Home, MapPin, BookOpen, Map, Navigation, MessageCircle, BarChart3 };

export default function MobileMenuOverlay({ currentUser, onLogout, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNav = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/40"
      onClick={onClose}
    >
      <motion.nav
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 top-0 bottom-0 w-64 bg-surface shadow-2xl flex flex-col py-8"
      >
        <div className="px-8 mb-10 flex justify-between items-start">
          <LogoText />
          <button onClick={onClose} className="text-muted hover:text-heading">
            <X size={24} />
          </button>
        </div>

        <ul className="flex-1 flex flex-col gap-2 px-4">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon] || MapPin;
            const isActive = location.pathname === item.path;
            return (
              <li key={item.key}>
                <button
                  onClick={() => handleNav(item.path)}
                  className={clsx(
                    'flex items-center gap-4 w-full py-3 px-4 font-serif tracking-widest uppercase text-xs transition-colors',
                    isActive
                      ? 'text-heading font-semibold border-l-2 border-accent'
                      : 'text-muted hover:text-heading'
                  )}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="px-8 mt-auto space-y-4">
          <button
            onClick={() => handleNav('/profile')}
            className="flex items-center gap-4 text-muted hover:text-heading transition-colors w-full"
          >
            <User size={18} />
            <span className="font-serif tracking-widest uppercase text-xs">
              {currentUser?.username || 'Profile'}
            </span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-4 text-muted hover:text-heading transition-colors w-full"
          >
            <LogOut size={18} />
            <span className="font-serif tracking-widest uppercase text-xs">Logout</span>
          </button>
        </div>
      </motion.nav>
    </motion.div>
  );
}
