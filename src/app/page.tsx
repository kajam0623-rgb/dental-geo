'use client';

import { useState, useEffect } from 'react';
import { Activity, Sparkles, MapPin, Search as SearchIcon, ChevronLeft, Save, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchForm from '@/components/SearchForm';
import PromptSelector from '@/components/PromptSelector';
import V3Dashboard from '@/components/V3Dashboard';
import ClinicList from '@/components/ClinicList';
import { generatePromptsV3 } from '@/utils/promptGenerator';
import { loadHistory, saveHistory } from '@/utils/historyStorage';
import { getClinics, saveClinicScan, savedScanToResult } from '@/utils/clinicStorage';
import type { V3SearchInput, ScanSettings, PromptItem, V3AnalysisResult, HistoryRecord, ClinicRecord, SavedScan } from '@/types/v3';

type Step = 'home' | 'input' | 'prompts' | 'loading' | 'results';

export default function Home() {
  const [step, setStep] = useState<Step>('home');
  const [searchInput, setSearchInput] = useState<V3SearchInput | null>(null);
  const [generatedPrompts, setGeneratedPrompts] = useState<PromptItem[]>([]);
  const [result, setResult] = useState<V3AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('AI 엔진 분석 중...');
  const [clinics, setClinics] = useState<ClinicRecord[]>([]);
  const [isFromSaved, setIsFromSaved] = useState(false);
  const [scanSaved, setScanSaved] = useState(false);

  useEffect(() => {
    setClinics(getClinics());
  }, []);

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

  const refreshClinics = () => setClinics(getClinics());

  const handleInputNext = (input: V3SearchInput) => {
    setSearchInput(input);
    setGeneratedPrompts(generatePromptsV3(input.regions, input.treatments));
    setStep('prompts');
  };

  const runScan = async (
    selected: PromptItem[],
    settings: ScanSettings,
    inputOverride?: V3SearchInput,
  ) => {
    const inputToUse = inputOverride ?? searchInput;
    if (!inputToUse) return;
    setIsFromSaved(false);
    setScanSaved(false);
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
        body: JSON.stringify({ input: inputToUse, selectedPrompts: selected, settings }),
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

  const handleScanStart = (selected: PromptItem[], settings: ScanSettings) => {
    runScan(selected, settings);
  };

  const handleRescan = (scan: SavedScan) => {
    setSearchInput(scan.input);
    runScan(scan.promptResults.map(r => r.prompt), scan.settings, scan.input);
  };

  const handleNewPromptScan = (scan: SavedScan) => {
    setSearchInput(scan.input);
    setGeneratedPrompts(generatePromptsV3(scan.input.regions, scan.input.treatments));
    setStep('prompts');
  };

  const handleViewScan = (scan: SavedScan) => {
    setResult(savedScanToResult(scan));
    setHistory(loadHistory(scan.input.clinicFullName));
    setIsFromSaved(true);
    setScanSaved(false);
    setStep('results');
  };

  const handleSave = () => {
    if (!result) return;
    saveClinicScan(result);
    setScanSaved(true);
    refreshClinics();
  };

  const reset = () => {
    setStep('home');
    setSearchInput(null);
    setGeneratedPrompts([]);
    setResult(null);
    setIsFromSaved(false);
    setScanSaved(false);
    refreshClinics();
  };

  const goBack = () => {
    if (step === 'input') { setStep('home'); return; }
    if (step === 'prompts') { setStep('input'); return; }
    if (step === 'results') { setStep('home'); return; }
    setStep('home');
  };

  return (
    <div className="min-h-screen bg-slate-950 font-[family-name:var(--font-geist-sans)] pb-32 text-slate-100 overflow-hidden relative">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#006400]/30 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-black/60 blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {step !== 'home' && (
            <button onClick={goBack} className="p-2 rounded-xl hover:bg-white/10 transition text-slate-400 hover:text-white mr-1">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="bg-gradient-to-tr from-[#006400] to-black p-2 rounded-xl shadow-lg shadow-[#006400]/30">
            <Activity className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            닥터원츠 <span className="text-[#00a000]">GEO</span> 프로그램
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
          <Sparkles className="w-4 h-4 text-[#00a000]" />
          마케팅 대행사용 AI 점유율 분석 스캐너
        </div>
      </header>

      {/* Step Indicator */}
      {(['input', 'prompts', 'loading'] as Step[]).includes(step) && (
        <div className="flex items-center justify-center gap-2 pt-8 pb-2">
          {(['input', 'prompts', 'loading'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s ? 'bg-[#006400] text-white' :
                step === 'loading' && i < (['input', 'prompts', 'loading'] as const).indexOf(step)
                  ? 'bg-[#006400]/30 text-[#00a000]' : 'bg-slate-800 text-slate-500'
              }`}>{i + 1}</div>
              {i < 2 && <div className="w-8 h-px bg-slate-700" />}
            </div>
          ))}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 pt-10 pb-12 flex flex-col items-center relative z-10">
        <AnimatePresence mode="wait">

          {/* Home */}
          {step === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
              <ClinicList
                clinics={clinics}
                onNewAnalysis={() => setStep('input')}
                onViewScan={handleViewScan}
                onRescan={handleRescan}
                onNewPromptScan={handleNewPromptScan}
                onRefresh={refreshClinics}
              />
            </motion.div>
          )}

          {/* Input */}
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full space-y-10">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#006400]/50 bg-[#006400]/10 text-[#00a000] text-sm font-semibold">
                  <MapPin className="w-4 h-4" />
                  실제 환자들의 로컬 검색점유율 분석
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                  치과 AI 플랫폼 검색 장악력을<br className="hidden md:block" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#006400] to-[#009900]"> 한눈에 확인하세요</span>
                </h2>
                <p className="text-slate-400 text-base max-w-xl mx-auto">치과명, 진료과목, 지역을 입력하면 AI가 롱테일 프롬프트를 자동 생성합니다.</p>
              </div>
              <SearchForm onNext={handleInputNext} />
            </motion.div>
          )}

          {/* Prompts */}
          {step === 'prompts' && (
            <motion.div key="prompts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white">프롬프트 설정</h2>
                <p className="text-slate-400 text-sm mt-1">{searchInput?.clinicFullName} · {searchInput?.regions.join(', ')}</p>
              </div>
              <PromptSelector prompts={generatedPrompts} onStart={handleScanStart} />
            </motion.div>
          )}

          {/* Loading */}
          {step === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-32 space-y-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-[#006400]/30 rounded-full" />
                <div className="absolute inset-0 border-4 border-[#006400] border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <SearchIcon className="w-8 h-8 text-[#00a000]" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[#00a000] font-bold text-xl">{loadingMsg}</p>
                <p className="text-slate-400 text-sm mt-2 max-w-sm">ChatGPT와 Gemini에 반복 질의 중입니다. 설정된 횟수에 따라 수 분이 소요될 수 있습니다.</p>
              </div>
            </motion.div>
          )}

          {/* Results */}
          {step === 'results' && result && (
            <motion.div key="results" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full">
              <V3Dashboard data={result} history={history} />
              <div className="mt-8 flex justify-center gap-4 flex-wrap">
                {!isFromSaved && (
                  <button
                    onClick={handleSave}
                    disabled={scanSaved}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                      scanSaved
                        ? 'bg-[#006400]/20 text-[#00a000] border border-[#006400]/40 cursor-default'
                        : 'bg-gradient-to-r from-[#006400] to-black text-white hover:shadow-[0_0_20px_rgba(0,100,0,0.4)] hover:scale-[1.01] active:scale-95'
                    }`}
                  >
                    {scanSaved ? <><Check className="w-4 h-4" /> 저장됨</> : <><Save className="w-4 h-4" /> 치과 저장</>}
                  </button>
                )}
                <button onClick={reset} className="px-8 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition font-medium">
                  {isFromSaved ? '목록으로' : '새로운 분석 시작'}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
