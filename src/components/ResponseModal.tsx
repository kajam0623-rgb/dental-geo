'use client';

import React, { useEffect, useRef } from 'react';
import { X, Sparkles, Bot, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  keyword: string;
  engine: 'chatgpt' | 'gemini';
  mentioned: boolean;
  responseText: string;
}

export default function ResponseModal({ isOpen, onClose, keyword, engine, mentioned, responseText }: ResponseModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handler);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const engineConfig = engine === 'chatgpt'
    ? { label: 'ChatGPT', color: 'emerald', icon: Bot, gradient: 'from-emerald-500 to-teal-500', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400' }
    : { label: 'Gemini', color: 'purple', icon: Sparkles, gradient: 'from-purple-500 to-indigo-500', border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400' };

  const EngineIcon = engineConfig.icon;

  // Highlight clinic name mentions in response text with bold styling
  const formatResponseText = (text: string) => {
    // Converts **bold** markdown to styled spans
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return (
          <span key={i} className="font-bold text-white bg-blue-500/20 px-1 rounded">
            {inner}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, type: 'spring', bounce: 0.15 }}
            className="relative w-full max-w-2xl max-h-[80vh] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r ${engineConfig.gradient}/10`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${engineConfig.bg} ${engineConfig.border} border`}>
                  <EngineIcon className={`w-5 h-5 ${engineConfig.text}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {engineConfig.label} 응답 원문
                    {mentioned ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        노출됨 ✓
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                        노출안됨 ✗
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-slate-400 mt-0.5">AI가 실제로 반환한 텍스트를 확인하세요</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Prompt (query) */}
            <div className="px-6 pt-5 pb-3">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-800/60 border border-white/5">
                <Search className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">검색 프롬프트</div>
                  <p className="text-sm text-slate-300 leading-relaxed">{keyword}</p>
                </div>
              </div>
            </div>

            {/* Response body */}
            <div className="px-6 pb-6 pt-2 overflow-y-auto flex-1 custom-scrollbar">
              <div className="p-5 rounded-2xl bg-slate-800/40 border border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <EngineIcon className={`w-4 h-4 ${engineConfig.text}`} />
                  <span className={`text-xs font-semibold ${engineConfig.text} uppercase tracking-wider`}>
                    {engineConfig.label} 응답
                  </span>
                </div>
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {formatResponseText(responseText)}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
