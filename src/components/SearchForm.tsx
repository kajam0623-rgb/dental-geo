'use client';

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { V3SearchInput } from '@/types/v3';

interface SearchFormProps {
  onNext: (input: V3SearchInput) => void;
  isLoading?: boolean;
}

export default function SearchForm({ onNext, isLoading = false }: SearchFormProps) {
  const [clinicFullName, setClinicFullName] = useState('');
  const [clinicShortName, setClinicShortName] = useState('');
  const [t1, setT1] = useState('');
  const [t2, setT2] = useState('');
  const [t3, setT3] = useState('');
  const [r1, setR1] = useState('');
  const [r2, setR2] = useState('');
  const [r3, setR3] = useState('');

  const canSubmit = clinicFullName.trim() && t1.trim() && r1.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const treatments = [t1, t2, t3].map(s => s.trim()).filter(Boolean);
    const regions = [r1, r2, r3].map(s => s.trim()).filter(Boolean);
    onNext({ clinicFullName: clinicFullName.trim(), clinicShortName: clinicShortName.trim(), treatments, regions });
  };

  const inputCls = "w-full px-4 py-3.5 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-slate-500 disabled:opacity-50 text-sm";

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/10 w-full max-w-4xl mx-auto flex flex-col gap-6">

      {/* 치과명 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-300">치과 풀네임 <span className="text-rose-400">*</span></label>
          <input type="text" value={clinicFullName} onChange={e => setClinicFullName(e.target.value)}
            placeholder="강남우리치과의원" disabled={isLoading} className={inputCls} required />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-300">단축명 <span className="text-slate-500 font-normal">(선택)</span></label>
          <input type="text" value={clinicShortName} onChange={e => setClinicShortName(e.target.value)}
            placeholder="우리치과" disabled={isLoading} className={inputCls} />
        </div>
      </div>

      {/* 진료과목 3개 박스 */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-300">
          진료과목 <span className="text-rose-400">*</span>
          <span className="text-slate-500 font-normal ml-1">최대 3개</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <input type="text" value={t1} onChange={e => setT1(e.target.value)}
              placeholder="임플란트" disabled={isLoading} className={inputCls} />
            <p className="text-xs text-slate-600 pl-1">1번째</p>
          </div>
          <div className="space-y-1">
            <input type="text" value={t2} onChange={e => setT2(e.target.value)}
              placeholder="교정 (선택)" disabled={isLoading} className={inputCls} />
            <p className="text-xs text-slate-600 pl-1">2번째</p>
          </div>
          <div className="space-y-1">
            <input type="text" value={t3} onChange={e => setT3(e.target.value)}
              placeholder="라미네이트 (선택)" disabled={isLoading} className={inputCls} />
            <p className="text-xs text-slate-600 pl-1">3번째</p>
          </div>
        </div>
      </div>

      {/* 지역명 3개 박스 */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-300">
          지역명 <span className="text-rose-400">*</span>
          <span className="text-slate-500 font-normal ml-1">최대 3개</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <input type="text" value={r1} onChange={e => setR1(e.target.value)}
              placeholder="강남역" disabled={isLoading} className={inputCls} />
            <p className="text-xs text-slate-600 pl-1">1번째</p>
          </div>
          <div className="space-y-1">
            <input type="text" value={r2} onChange={e => setR2(e.target.value)}
              placeholder="서초구 (선택)" disabled={isLoading} className={inputCls} />
            <p className="text-xs text-slate-600 pl-1">2번째</p>
          </div>
          <div className="space-y-1">
            <input type="text" value={r3} onChange={e => setR3(e.target.value)}
              placeholder="강남구 (선택)" disabled={isLoading} className={inputCls} />
            <p className="text-xs text-slate-600 pl-1">3번째</p>
          </div>
        </div>
      </div>

      <button type="submit" disabled={isLoading || !canSubmit}
        className="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none">
        프롬프트 자동 생성
        <ChevronRight className="w-5 h-5" />
      </button>
    </form>
  );
}
