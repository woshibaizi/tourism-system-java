import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Home, MapPin, BookOpen, Map, Navigation,
  MessageCircle, BarChart3, LogOut, User,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { NAV_ITEMS } from '../../utils/constants';
import LogoText from '../ui/LogoText';

const iconMap = { Home, MapPin, BookOpen, Map, Navigation, MessageCircle, BarChart3 };

export default function LeftSidebar({ currentUser, onLogout, collapsed, onToggleCollapse, className }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      className={clsx(
        'flex flex-col h-screen fixed left-0 top-0 z-40 bg-surface border-r border-border',
        'transition-[width] duration-300 ease-out',
        collapsed ? 'w-16 py-8' : 'w-56 py-8',
        'max-md:hidden',
        className
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center text-muted hover:text-heading hover:border-accent transition-colors shadow-sm z-50"
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div className={clsx(collapsed ? 'px-0 flex justify-center mb-6' : 'px-6 mb-6')}>
        <LogoText variant={collapsed ? 'compact' : 'default'} />
      </div>

      {/* Navigation items */}
      <ul className="flex-1 flex flex-col gap-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon] || MapPin;
          const isActive = location.pathname === item.path;
          return (
            <li key={item.key}>
              <button
                onClick={() => navigate(item.path)}
                className={clsx(
                  'relative flex items-center w-full transition-colors duration-300',
                  collapsed ? 'justify-center py-3 px-0' : 'gap-4 py-3 px-4',
                  isActive
                    ? 'text-heading font-semibold'
                    : 'text-muted hover:text-heading'
                )}
              >
                {isActive && !collapsed && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-accent"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <Icon size={collapsed ? 20 : 18} />
                {!collapsed && (
                  <span className="font-serif tracking-widest uppercase text-xs">{item.label}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Bottom section: profile + logout only */}
      <div className={clsx('mt-auto border-t border-border', collapsed ? 'px-0' : 'px-4')}>
        {/* Profile link */}
        <button
          onClick={() => navigate('/profile')}
          className={clsx(
            'flex items-center text-muted hover:text-heading transition-colors w-full',
            collapsed ? 'justify-center py-2 mt-3' : 'gap-3 py-2 mt-3'
          )}
        >
          <User size={16} />
          {!collapsed && <span className="font-serif tracking-widest uppercase text-xs">{currentUser?.username || 'Profile'}</span>}
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className={clsx(
            'flex items-center text-muted hover:text-heading transition-colors w-full',
            collapsed ? 'justify-center py-2 mb-4' : 'gap-3 py-2 mb-4'
          )}
        >
          <LogOut size={16} />
          {!collapsed && <span className="font-serif tracking-widest uppercase text-xs">退出</span>}
        </button>
      </div>
    </nav>
  );
}
