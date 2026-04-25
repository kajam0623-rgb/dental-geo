'use client';

import { useState, useEffect } from 'react';
import { Activity, Sparkles, MapPin, Search as SearchIcon, ChevronLeft, Save, Check, RefreshCw } from 'lucide-react';
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
    getClinics().then(setClinics);
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

  const refreshClinics = () => { getClinics().then(setClinics); };

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

  const handleViewScan = (scan: SavedScan, clinic: ClinicRecord) => {
    setResult(savedScanToResult(scan));
    const h: HistoryRecord[] = [...clinic.scans].reverse().slice(-30).map(s => ({
      scanDate: s.scanDate,
      clinicFullName: s.input.clinicFullName,
      clinicShortName: s.input.clinicShortName,
      chatgptSov: s.summary.chatgpt.sov,
      geminiSov: s.summary.gemini.sov,
      overallSov: s.summary.overall.sov,
    }));
    setHistory(h);
    setIsFromSaved(true);
    setScanSaved(false);
    setStep('results');
  };

  const handleSave = async () => {
    if (!result) return;
    await saveClinicScan(result);
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
    <div className="min-h-screen bg-[#f2f0eb] font-[family-name:var(--font-inter)] pb-32 overflow-hidden">

      {/* Header — House Green feature band */}
      <header
        className="bg-[#1E3932] sticky top-0 z-50 px-6 py-4 flex items-center justify-between"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.2), 0 2px 2px rgba(0,0,0,0.12), 0 0 2px rgba(0,0,0,0.10)' }}
      >
        <div className="flex items-center gap-3">
          {step !== 'home' && (
            <button
              onClick={goBack}
              className="p-2 rounded-full hover:bg-white/10 transition text-white/70 hover:text-white mr-1 active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="bg-[#00754A] p-2 rounded-xl">
            <Activity className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white" style={{ letterSpacing: '-0.16px' }}>
            닥터원츠 <span className="text-[#d4e9e2]">GEO</span> 프로그램
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-white/70 bg-white/10 px-3 py-1.5 rounded-full">
          <Sparkles className="w-4 h-4 text-[#d4e9e2]" />
          마케팅 대행사용 AI 점유율 분석 스캐너
        </div>
      </header>

      {/* Step Indicator */}
      {(['input', 'prompts', 'loading'] as Step[]).includes(step) && (
        <div className="flex items-center justify-center gap-2 pt-8 pb-2">
          {(['input', 'prompts', 'loading'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s
                  ? 'bg-[#00754A] text-white'
                  : step === 'loading' && i < (['input', 'prompts', 'loading'] as const).indexOf(step)
                  ? 'bg-[#d4e9e2] text-[#006241]'
                  : 'bg-[#edebe9] text-black/40'
              }`}>{i + 1}</div>
              {i < 2 && <div className="w-8 h-px bg-black/15" />}
            </div>
          ))}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 pt-10 pb-12 flex flex-col items-center">
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
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#006241]/30 bg-[#d4e9e2] text-[#006241] text-sm font-semibold">
                  <MapPin className="w-4 h-4" />
                  실제 환자들의 로컬 검색점유율 분석
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-[#006241] tracking-tight leading-tight" style={{ letterSpacing: '-0.16px' }}>
                  치과 AI 플랫폼 검색 장악력을<br className="hidden md:block" />
                  <span className="text-[#1E3932]"> 한눈에 확인하세요</span>
                </h2>
                <p className="text-black/[0.58] text-base max-w-xl mx-auto">치과명, 진료과목, 지역을 입력하면 AI가 롱테일 프롬프트를 자동 생성합니다.</p>
              </div>
              <SearchForm onNext={handleInputNext} />
            </motion.div>
          )}

          {/* Prompts */}
          {step === 'prompts' && (
            <motion.div key="prompts" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-[#1E3932]" style={{ letterSpacing: '-0.16px' }}>프롬프트 설정</h2>
                <p className="text-black/[0.55] text-sm mt-1">{searchInput?.clinicFullName} · {searchInput?.regions.join(', ')}</p>
              </div>
              <PromptSelector prompts={generatedPrompts} onStart={handleScanStart} />
            </motion.div>
          )}

          {/* Loading */}
          {step === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-32 space-y-6">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-[#d4e9e2] rounded-full" />
                <div className="absolute inset-0 border-4 border-[#00754A] border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <SearchIcon className="w-8 h-8 text-[#006241]" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[#006241] font-bold text-xl">{loadingMsg}</p>
                <p className="text-black/[0.55] text-sm mt-2 max-w-sm">ChatGPT와 Gemini에 반복 질의 중입니다. 설정된 횟수에 따라 수 분이 소요될 수 있습니다.</p>
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
                    className={`flex items-center gap-2 px-6 py-3 font-bold text-sm transition-all active:scale-95 ${
                      scanSaved
                        ? 'bg-[#d4e9e2] text-[#006241] border border-[#006241]/30 cursor-default rounded-[50px]'
                        : 'bg-[#00754A] text-white rounded-[50px] hover:shadow-[0_4px_12px_rgba(0,117,74,0.3)]'
                    }`}
                  >
                    {scanSaved ? <><Check className="w-4 h-4" /> 저장됨</> : <><Save className="w-4 h-4" /> 치과 저장</>}
                  </button>
                )}
                {isFromSaved && (
                  <button
                    onClick={() => {
                      if (!result) return;
                      setSearchInput(result.input);
                      setGeneratedPrompts(generatePromptsV3(result.input.regions, result.input.treatments));
                      setIsFromSaved(false);
                      setScanSaved(false);
                      setStep('prompts');
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-[50px] bg-[#00754A] text-white font-bold text-sm hover:shadow-[0_4px_12px_rgba(0,117,74,0.3)] active:scale-95 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" /> 이 치과로 새 분석
                  </button>
                )}
                <button
                  onClick={reset}
                  className="px-8 py-3 rounded-[50px] border border-black/20 text-black/[0.58] hover:text-black/87 hover:border-black/30 transition font-medium active:scale-95"
                >
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
