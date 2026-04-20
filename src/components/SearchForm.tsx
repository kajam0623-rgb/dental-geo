'use client';

import React, { useState } from 'react';
import { Search, Target, BarChart3 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ScanMode = 'multi' | 'deep';

interface SearchFormProps {
  onSubmit: (data: { clinicName: string; region: string; treatment: string }) => void;
  onDeepScan: (data: { clinicName: string; region: string; treatment: string; prompt: string; repeatCount: number }) => void;
  isLoading?: boolean;
}

export default function SearchForm({ onSubmit, onDeepScan, isLoading = false }: SearchFormProps) {
  const [clinicName, setClinicName] = useState('');
  const [region, setRegion] = useState('');
  const [treatment, setTreatment] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('multi');
  const [customPrompt, setCustomPrompt] = useState('');
  const [repeatCount, setRepeatCount] = useState(20);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName || !region || !treatment) return;
    
    if (scanMode === 'deep') {
      const prompt = customPrompt.trim() || `${region} ${treatment} 잘하는 치과 추천해줘 답변 시 반드시 실제로 존재하는 특정 병원(치과)의 이름만 3~5개 짧게 나열해 주세요. 추가 설명은 생략하세요.`;
      onDeepScan({ clinicName, region, treatment, prompt, repeatCount });
    } else {
      onSubmit({ clinicName, region, treatment });
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl shadow-2xl shadow-blue-900/10 border border-white/10 w-full max-w-4xl mx-auto flex flex-col gap-6 transition-all"
    >
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 p-1 bg-slate-800/60 rounded-xl border border-white/5 w-fit mx-auto">
        <button
          type="button"
          onClick={() => setScanMode('multi')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
            scanMode === 'multi'
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <BarChart3 className="w-4 h-4" />
          다중 키워드 스캔
        </button>
        <button
          type="button"
          onClick={() => setScanMode('deep')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
            scanMode === 'deep'
              ? "bg-amber-600 text-white shadow-lg shadow-amber-500/20"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Target className="w-4 h-4" />
          정밀 반복 스캔
        </button>
      </div>

      {/* Mode Description */}
      <div className="text-center text-xs text-slate-500">
        {scanMode === 'multi' 
          ? '10개 다양한 롱테일 키워드로 폭넓게 스캔합니다'
          : '하나의 프롬프트를 여러 번 반복하여 일관성을 정밀 측정합니다'
        }
      </div>

      {/* 기본 입력 필드 */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 w-full space-y-3">
          <label htmlFor="clinicName" className="block text-sm font-semibold text-slate-300">치과명</label>
          <input
            id="clinicName"
            type="text"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="강남우리치과"
            disabled={isLoading}
            className="w-full px-5 py-4 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-500 disabled:opacity-50"
            required
          />
        </div>
        <div className="flex-1 w-full space-y-3">
          <label htmlFor="region" className="block text-sm font-semibold text-slate-300">지역명</label>
          <input
            id="region"
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="강남역"
            disabled={isLoading}
            className="w-full px-5 py-4 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-500 disabled:opacity-50"
            required
          />
        </div>
        <div className="flex-1 w-full space-y-3">
          <label htmlFor="treatment" className="block text-sm font-semibold text-slate-300">진료명</label>
          <input
            id="treatment"
            type="text"
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            placeholder="임플란트"
            disabled={isLoading}
            className="w-full px-5 py-4 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-500 disabled:opacity-50"
            required
          />
        </div>
      </div>

      {/* 정밀 스캔 전용 필드 */}
      {scanMode === 'deep' && (
        <div className="space-y-4 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 animate-in fade-in duration-300">
          <div className="space-y-3">
            <label htmlFor="customPrompt" className="block text-sm font-semibold text-amber-300">
              검색 프롬프트 <span className="text-slate-500 font-normal">(비워두면 자동 생성)</span>
            </label>
            <textarea
              id="customPrompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={`예: ${region || '강남'} ${treatment || '임플란트'} 잘하는 치과 추천해줘`}
              disabled={isLoading}
              rows={2}
              className="w-full px-5 py-4 rounded-xl border border-amber-700/30 bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all placeholder:text-slate-500 disabled:opacity-50 resize-none"
            />
          </div>
          <div className="flex items-center gap-4">
            <label htmlFor="repeatCount" className="text-sm font-semibold text-amber-300 whitespace-nowrap">반복 횟수</label>
            <input
              id="repeatCount"
              type="range"
              min={5}
              max={20}
              step={5}
              value={repeatCount}
              onChange={(e) => setRepeatCount(Number(e.target.value))}
              disabled={isLoading}
              className="flex-1 accent-amber-500"
            />
            <span className="text-amber-400 font-bold text-lg w-12 text-right">{repeatCount}회</span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !clinicName || !region || !treatment}
        className={cn(
          "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
          scanMode === 'multi'
            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] hover:scale-[1.01]"
            : "bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:scale-[1.01]"
        )}
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : scanMode === 'multi' ? (
          <Search className="w-5 h-5" />
        ) : (
          <Target className="w-5 h-5" />
        )}
        <span>{scanMode === 'multi' ? '다중 키워드 분석 시작' : `정밀 반복 분석 시작 (${repeatCount}회)`}</span>
      </button>
    </form>
  );
}
