/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { toastEmitter } from '../../services/api';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const colors = {
  success: 'border-green-500 text-green-800 bg-green-50',
  error: 'border-red-500 text-red-800 bg-red-50',
  info: 'border-blue-500 text-blue-800 bg-blue-50',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message, duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      addToast(e.detail.type, e.detail.message);
    };
    toastEmitter.addEventListener('toast', handler);
    return () => toastEmitter.removeEventListener('toast', handler);
  }, [addToast]);

  const showToast = useCallback(
    (type, message) => {
      if (typeof type === 'object' && type !== null) {
        addToast('error', type.message || String(type));
      } else {
        addToast(type, message);
      }
    },
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = icons[toast.type] || Info;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-sm border-l-4 shadow-lg bg-surface min-w-[280px] max-w-[420px] ${colors[toast.type] || colors.info}`}
              >
                <Icon size={18} />
                <span className="flex-1 text-sm font-sans">{toast.message}</span>
                <button onClick={() => removeToast(toast.id)} className="text-current opacity-50 hover:opacity-100">
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
