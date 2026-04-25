'use client';

import React, { useState } from 'react';
import { Check, Pencil, Trash2, Plus, Sparkles, ChevronRight } from 'lucide-react';
import type { PromptItem, PromptCategory, ScanSettings } from '@/types/v3';

const CATEGORY_COLORS: Record<PromptCategory, string> = {
  '지역형': 'bg-[#d4e9e2] text-[#006241] border-[#006241]/20',
  '증상형': 'bg-rose-50 text-rose-700 border-rose-200',
  '비교형': 'bg-amber-50 text-amber-700 border-amber-200',
  '추천형': 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const COUNT_OPTIONS = [3, 5, 10] as const;

interface PromptSelectorProps {
  prompts: PromptItem[];
  onStart: (selected: PromptItem[], settings: ScanSettings) => void;
  isLoading?: boolean;
}

export default function PromptSelector({ prompts, onStart, isLoading = false }: PromptSelectorProps) {
  const [items, setItems] = useState<PromptItem[]>(prompts);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [maxSelect, setMaxSelect] = useState<5 | 10>(5);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [chatgptCount, setChatgptCount] = useState<3 | 5 | 10>(5);
  const [geminiCount, setGeminiCount] = useState<3 | 5 | 10>(5);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < maxSelect) {
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
    if (selected.size < maxSelect) setSelected(prev => new Set([...prev, newItem.id]));
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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#006241]/30 bg-[#d4e9e2] text-[#006241] text-sm font-semibold">
          <Sparkles className="w-4 h-4" />
          자동 생성된 프롬프트
        </div>
        <p className="text-black/[0.55] text-sm">
          병원 정보 기반으로 자동 생성되었습니다. 자유롭게 수정, 삭제하거나 새로 추가할 수 있습니다.
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-black/40 text-xs">
            선택됨: <span className="font-bold text-[#006241]">{selected.size} / {maxSelect}개</span>
          </span>
          <div className="flex gap-1">
            {([5, 10] as const).map(n => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setMaxSelect(n);
                  if (selected.size > n) {
                    setSelected(new Set([...selected].slice(0, n)));
                  }
                }}
                className={`px-3 py-1 rounded-[50px] text-xs font-bold border transition-all active:scale-95 ${
                  maxSelect === n
                    ? 'bg-[#00754A] border-[#00754A] text-white'
                    : 'border-black/20 text-black/[0.55] hover:text-[#006241] hover:border-[#006241]/40'
                }`}
              >
                {n}개
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Prompt List */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
        {items.map(item => (
          <div
            key={item.id}
            className={`group flex items-start gap-3 p-4 rounded-[12px] border transition-all cursor-pointer ${
              selected.has(item.id)
                ? 'bg-[#d4e9e2]/40 border-[#006241]/30'
                : 'bg-white border-black/[0.08] hover:border-black/20'
            }`}
            style={selected.has(item.id) ? {} : { boxShadow: '0 0 0.5px rgba(0,0,0,0.10)' }}
            onClick={() => !editingId && toggle(item.id)}
          >
            {/* Checkbox */}
            <div className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all ${
              selected.has(item.id) ? 'bg-[#00754A] border-[#00754A]' : 'border-black/25'
            }`}>
              {selected.has(item.id) && <Check className="w-3 h-3 text-white" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {editingId === item.id ? (
                <textarea
                  className="w-full bg-[#f2f0eb] text-black/87 text-sm rounded-[8px] px-3 py-2 outline-none focus:ring-2 focus:ring-[#00754A] border border-[#d6dbde] resize-none"
                  rows={2}
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
                  autoFocus
                />
              ) : (
                <p className="text-sm text-black/75 leading-relaxed">{item.displayText}</p>
              )}
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs border font-medium ${CATEGORY_COLORS[item.category]}`}>
                {item.category}
              </span>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              {editingId === item.id ? (
                <button onClick={saveEdit} className="p-1.5 rounded-[50px] bg-[#00754A] hover:bg-[#006241] text-white text-xs font-bold px-3 active:scale-95">저장</button>
              ) : (
                <button onClick={() => startEdit(item)} className="p-1.5 rounded-full hover:bg-black/5 text-black/40 hover:text-black/75 active:scale-95">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-full hover:bg-[#c82014]/10 text-black/40 hover:text-[#c82014] active:scale-95">
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
            className="flex-1 px-4 py-3 rounded-[8px] border border-[#d6dbde] bg-white text-black/87 text-sm focus:outline-none focus:border-[#00754A] focus:ring-1 focus:ring-[#00754A] placeholder:text-black/30"
          />
          <button
            type="button"
            onClick={addPrompt}
            className="px-4 py-3 rounded-[50px] bg-[#edebe9] hover:bg-[#d4e9e2] text-black/[0.55] hover:text-[#006241] transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Scan Settings */}
      <div
        className="p-5 rounded-[12px] bg-[#edebe9] space-y-4"
      >
        <p className="text-sm font-semibold text-black/75">스캔 횟수 설정</p>
        <div className="grid grid-cols-2 gap-4">
          {(['chatgpt', 'gemini'] as const).map(engine => (
            <div key={engine} className="space-y-2">
              <label className="text-xs text-black/[0.55] font-semibold uppercase tracking-wide">
                {engine === 'chatgpt' ? 'ChatGPT' : 'Gemini'}
              </label>
              <div className="flex gap-2">
                {COUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => engine === 'chatgpt' ? setChatgptCount(n) : setGeminiCount(n)}
                    className={`flex-1 py-2 rounded-[50px] text-sm font-bold transition-all border active:scale-95 ${
                      (engine === 'chatgpt' ? chatgptCount : geminiCount) === n
                        ? 'bg-[#00754A] border-[#00754A] text-white'
                        : 'border-black/20 text-black/[0.55] hover:border-[#006241]/40 hover:text-[#006241] bg-white'
                    }`}
                  >
                    {n}회
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-black/40 text-center">
          총 API 호출: <span className="text-black/75 font-bold">{totalCalls}회</span> ({selected.size}개 프롬프트 × 각 {chatgptCount + geminiCount}회)
        </p>
      </div>

      {/* Start Button */}
      <button
        onClick={handleStart}
        disabled={isLoading || selected.size === 0}
        className="w-full py-4 rounded-[50px] font-bold flex items-center justify-center gap-2 bg-[#00754A] text-white hover:shadow-[0_4px_16px_rgba(0,117,74,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
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
