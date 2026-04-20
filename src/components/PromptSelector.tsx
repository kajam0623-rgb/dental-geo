'use client';

import React, { useState } from 'react';
import { Check, Pencil, Trash2, Plus, Sparkles, ChevronRight } from 'lucide-react';
import type { PromptItem, PromptCategory, ScanSettings } from '@/types/v3';

const CATEGORY_COLORS: Record<PromptCategory, string> = {
  '지역형': 'bg-[#006400]/20 text-[#00a000] border-[#006400]/30',
  '증상형': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  '비교형': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  '추천형': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

const COUNT_OPTIONS: Array<3 | 5 | 10 | 20> = [3, 5, 10, 20];

interface PromptSelectorProps {
  prompts: PromptItem[];
  onStart: (selected: PromptItem[], settings: ScanSettings) => void;
  isLoading?: boolean;
}

export default function PromptSelector({ prompts, onStart, isLoading = false }: PromptSelectorProps) {
  const [items, setItems] = useState<PromptItem[]>(prompts);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [chatgptCount, setChatgptCount] = useState<3 | 5 | 10 | 20>(5);
  const [geminiCount, setGeminiCount] = useState<3 | 5 | 10 | 20>(5);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  };

  const startEdit = (item: PromptItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const saveEdit = () => {
    setItems(prev => prev.map(p => p.id === editingId ? { ...p, text: editText } : p));
    setEditingId(null);
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  const addPrompt = () => {
    const text = newPrompt.trim();
    if (!text || items.length >= 20) return;
    const newItem: PromptItem = { id: `custom-${Date.now()}`, text, displayText: text, category: '추천형' };
    setItems(prev => [...prev, newItem]);
    if (selected.size < 5) setSelected(prev => new Set([...prev, newItem.id]));
    setNewPrompt('');
  };

  const handleStart = () => {
    const selectedItems = items.filter(p => selected.has(p.id));
    if (selectedItems.length === 0) return;
    onStart(selectedItems, { chatgptCount, geminiCount });
  };

  const totalCalls = selected.size * (chatgptCount + geminiCount);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#006400]/50 bg-[#006400]/10 text-[#00a000] text-sm font-semibold">
          <Sparkles className="w-4 h-4" />
          자동 생성된 프롬프트
        </div>
        <p className="text-slate-400 text-sm">
          병원 정보 기반으로 자동 생성되었습니다. 자유롭게 수정, 삭제하거나 새로 추가할 수 있습니다.
        </p>
        <p className="text-slate-500 text-xs">
          선택된 프롬프트: <span className="font-bold text-[#00a000]">{selected.size} / 5개</span>
        </p>
      </div>

      {/* Prompt List */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
        {items.map(item => (
          <div
            key={item.id}
            className={`group flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
              selected.has(item.id)
                ? 'bg-slate-800/80 border-[#006400]/50'
                : 'bg-slate-900/40 border-white/5 hover:border-white/10'
            }`}
            onClick={() => !editingId && toggle(item.id)}
          >
            {/* Checkbox */}
            <div className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all ${
              selected.has(item.id) ? 'bg-[#006400] border-[#006400]' : 'border-slate-600'
            }`}>
              {selected.has(item.id) && <Check className="w-3 h-3 text-white" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {editingId === item.id ? (
                <textarea
                  className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#006400] resize-none"
                  rows={2}
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
                  autoFocus
                />
              ) : (
                <p className="text-sm text-slate-200 leading-relaxed">{item.displayText}</p>
              )}
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs border font-medium ${CATEGORY_COLORS[item.category]}`}>
                {item.category}
              </span>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              {editingId === item.id ? (
                <button onClick={saveEdit} className="p-1.5 rounded-lg bg-[#006400] hover:bg-[#004d00] text-white text-xs font-bold">저장</button>
              ) : (
                <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-rose-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Prompt */}
      {items.length < 20 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newPrompt}
            onChange={e => setNewPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPrompt()}
            placeholder="+ 프롬프트 직접 추가..."
            className="flex-1 px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/50 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#006400] placeholder:text-slate-500"
          />
          <button type="button" onClick={addPrompt} className="px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scan Settings */}
      <div className="p-5 rounded-2xl bg-slate-800/40 border border-white/10 space-y-4">
        <p className="text-sm font-semibold text-slate-300">스캔 횟수 설정</p>
        <div className="grid grid-cols-2 gap-4">
          {(['chatgpt', 'gemini'] as const).map(engine => (
            <div key={engine} className="space-y-2">
              <label className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                {engine === 'chatgpt' ? 'ChatGPT' : 'Gemini'}
              </label>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => engine === 'chatgpt' ? setChatgptCount(n) : setGeminiCount(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${
                      (engine === 'chatgpt' ? chatgptCount : geminiCount) === n
                        ? engine === 'chatgpt'
                          ? 'bg-[#006400] border-[#006400] text-white'
                          : 'bg-black border-black text-white'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    {n}회
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center">
          총 API 호출: <span className="text-slate-300 font-bold">{totalCalls}회</span> ({selected.size}개 프롬프트 × 각 {chatgptCount + geminiCount}회)
        </p>
      </div>

      {/* Start Button */}
      <button
        onClick={handleStart}
        disabled={isLoading || selected.size === 0}
        className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-[#006400] to-black text-white hover:shadow-[0_0_20px_rgba(0,100,0,0.5)] hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            스캔 시작
            <ChevronRight className="w-5 h-5" />
          </>
        )}
      </button>
    </div>
  );
}
