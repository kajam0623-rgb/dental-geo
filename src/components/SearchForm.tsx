'use client';

import React, { useState, KeyboardEvent } from 'react';
import { Plus, X, ChevronRight } from 'lucide-react';
import type { V3SearchInput } from '@/types/v3';

interface SearchFormProps {
  onNext: (input: V3SearchInput) => void;
  isLoading?: boolean;
}

function TagInput({
  label, placeholder, values, onChange, max, color,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (v: string[]) => void;
  max: number;
  color: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v) || values.length >= max) return;
    onChange([...values, v]);
    setDraft('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1));
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-300">
        {label} <span className="text-slate-500 font-normal">최대 {max}개</span>
      </label>
      <div className={`flex flex-wrap gap-2 px-4 py-3 rounded-xl border bg-slate-800/50 focus-within:ring-2 ${color} border-slate-700 min-h-[52px]`}>
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-700 text-sm text-white font-medium">
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))}>
              <X className="w-3 h-3 text-slate-400 hover:text-white" />
            </button>
          </span>
        ))}
        {values.length < max && (
          <input
            className="flex-1 min-w-[120px] bg-transparent text-white text-sm outline-none placeholder:text-slate-500"
            placeholder={values.length === 0 ? placeholder : `+ 추가 (${values.length}/${max})`}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKey}
            onBlur={add}
          />
        )}
      </div>
    </div>
  );
}

export default function SearchForm({ onNext, isLoading = false }: SearchFormProps) {
  const [clinicFullName, setClinicFullName] = useState('');
  const [clinicShortName, setClinicShortName] = useState('');
  const [treatments, setTreatments] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);

  const canSubmit = clinicFullName.trim() && treatments.length > 0 && regions.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onNext({ clinicFullName: clinicFullName.trim(), clinicShortName: clinicShortName.trim(), treatments, regions });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/10 w-full max-w-4xl mx-auto flex flex-col gap-6">

      {/* 치과명 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-300">치과 풀네임</label>
          <input
            type="text"
            value={clinicFullName}
            onChange={e => setClinicFullName(e.target.value)}
            placeholder="강남우리치과의원"
            disabled={isLoading}
            className="w-full px-5 py-4 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-slate-500 disabled:opacity-50"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-300">
            단축명 <span className="text-slate-500 font-normal">(선택)</span>
          </label>
          <input
            type="text"
            value={clinicShortName}
            onChange={e => setClinicShortName(e.target.value)}
            placeholder="우리치과"
            disabled={isLoading}
            className="w-full px-5 py-4 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-slate-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* 진료과목 태그 */}
      <TagInput
        label="진료과목"
        placeholder="임플란트 입력 후 Enter"
        values={treatments}
        onChange={setTreatments}
        max={3}
        color="focus-within:ring-blue-500"
      />

      {/* 지역명 태그 */}
      <TagInput
        label="지역명"
        placeholder="강남역 입력 후 Enter"
        values={regions}
        onChange={setRegions}
        max={3}
        color="focus-within:ring-purple-500"
      />

      <button
        type="submit"
        disabled={isLoading || !canSubmit}
        className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
      >
        프롬프트 자동 생성
        <ChevronRight className="w-5 h-5" />
      </button>
    </form>
  );
}
