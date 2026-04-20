'use client';

import { useState, useEffect } from 'react';
import { Activity, Sparkles, MapPin, Search as SearchIcon, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchForm from '@/components/SearchForm';
import PromptSelector from '@/components/PromptSelector';
import V3Dashboard from '@/components/V3Dashboard';
import { generatePromptsV3 } from '@/utils/promptGenerator';
import { loadHistory, saveHistory } from '@/utils/historyStorage';
import type { V3SearchInput, ScanSettings, PromptItem, V3AnalysisResult, HistoryRecord } from '@/types/v3';

type Step = 'input' | 'prompts' | 'loading' | 'results';

export default function Home() {
  const [step, setStep] = useState<Step>('input');
  const [searchInput, setSearchInput] = useState<V3SearchInput | null>(null);
  const [generatedPrompts, setGeneratedPrompts] = useState<PromptItem[]>([]);
  const [result, setResult] = useState<V3AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('AI 엔진 분석 중...');

  // Load history when result arrives
  useEffect(() => {
    if (result) {
      const h = loadHistory(result.input.clinicFullName);
      setHistory(h);
      saveHistory({
        scanDate: result.scanDate,
        clinicFullName: result.input.clinicFullName,
        clinicShortName: result.input.clinicShortName,
        chatgptSov: result.summary.chatgpt.sov,
        geminiSov: result.summary.gemini.sov,
        overallSov: result.summary.overall.sov,
      });
    }
  }, [result]);

  const handleInputNext = (input: V3SearchInput) => {
    setSearchInput(input);
    setGeneratedPrompts(generatePromptsV3(input.regions, input.treatments));
    setStep('prompts');
  };

  const handleScanStart = async (selected: PromptItem[], settings: ScanSettings) => {
    if (!searchInput) return;
    setStep('loading');

    const msgs = [
      'AI 엔진 분석 중...',
      `ChatGPT에 ${settings.chatgptCount}회 쿼리 중...`,
      `Gemini에 ${settings.geminiCount}회 쿼리 중...`,
      '경쟁사 데이터 집계 중...',
      '보고서 생성 중...',
    ];
    let mi = 0;
    const interval = setInterval(() => {
      mi = (mi + 1) % msgs.length;
      setLoadingMsg(msgs[mi]);
    }, 4000);

    try {
      const res = await fetch('/api/analyze-v3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: searchInput, selectedPrompts: selected, settings }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        setStep('results');
      } else {
        alert('분석 중 오류가 발생했습니다: ' + (json.error ?? ''));
        setStep('prompts');
      }
    } catch (e) {
      console.error(e);
      alert('서버와 통신할 수 없습니다.');
      setStep('prompts');
    } finally {
      clearInterval(interval);
    }
  };

  const reset = () => {
    setStep('input');
    setSearchInput(null);
    setGeneratedPrompts([]);
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 font-[family-name:var(--font-geist-sans)] pb-32 text-slate-100 overflow-hidden relative">
      {/* Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/30 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/20 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {step !== 'input' && (
            <button onClick={reset} className="p-2 rounded-xl hover:bg-white/10 transition text-slate-400 hover:text-white mr-1">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="bg-gradient-to-tr from-blue-500 to-indigo-500 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <Activity className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            닥터원츠 <span className="text-blue-400">GEO</span> 프로그램
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
          <Sparkles className="w-4 h-4 text-blue-400" />
          마케팅 대행사용 AI 점유율 분석 스캐너
        </div>
      </header>

      {/* Step Indicator */}
      {step !== 'results' && (
        <div className="flex items-center justify-center gap-2 pt-8 pb-2">
          {(['input', 'prompts', 'loading'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s ? 'bg-blue-600 text-white' :
                ['loading', 'results'].includes(step) && i < ['input','prompts','loading'].indexOf(step)
                  ? 'bg-blue-600/30 text-blue-400' : 'bg-slate-800 text-slate-500'
              }`}>{i + 1}</div>
              {i < 2 && <div className="w-8 h-px bg-slate-700" />}
            </div>
          ))}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 pt-10 pb-12 flex flex-col items-center relative z-10">
        <AnimatePresence mode="wait">

          {/* Step 1: Input */}
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full space-y-10">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-semibold">
                  <MapPin className="w-4 h-4" />
                  실제 환자들의 로컬 검색점유율 분석
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                  치과 AI 플랫폼 검색 장악력을<br className="hidden md:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400"> 한눈에 확인하세요</span>
                </h2>
                <p className="text-slate-400 text-base max-w-xl mx-auto">치과명, 진료과목, 지역을 입력하면 AI가 롱테일 프롬프트를 자동 생성합니다.</p>
              </div>
              <SearchForm onNext={handleInputNext} />
            </motion.div>
          )}

          {/* Step 2: Prompt Selection */}
          {step === 'prompts' && (
            <motion.div key="prompts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white">프롬프트 설정</h2>
                <p className="text-slate-400 text-sm mt-1">{searchInput?.clinicFullName} · {searchInput?.regions.join(', ')}</p>
              </div>
              <PromptSelector
                prompts={generatedPrompts}
                onStart={handleScanStart}
              />
            </motion.div>
          )}

          {/* Loading */}
          {step === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-32 space-y-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <SearchIcon className="w-8 h-8 text-blue-400" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-blue-400 font-bold text-xl">{loadingMsg}</p>
                <p className="text-slate-400 text-sm mt-2 max-w-sm">ChatGPT와 Gemini에 반복 질의 중입니다. 설정된 횟수에 따라 수 분이 소요될 수 있습니다.</p>
              </div>
            </motion.div>
          )}

          {/* Results */}
          {step === 'results' && result && (
            <motion.div key="results" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full">
              <V3Dashboard data={result} history={history} />
              <div className="mt-8 flex justify-center">
                <button onClick={reset} className="px-8 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition font-medium">
                  새로운 분석 시작
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
