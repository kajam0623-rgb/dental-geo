'use client';

import { useState, useEffect } from 'react';
import { Activity, Sparkles, MapPin, Search as SearchIcon, ChevronLeft, Save, Check, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SearchForm from '@/components/SearchForm';
import PromptSelector from '@/components/PromptSelector';
import V3Dashboard from '@/components/V3Dashboard';
import ClinicList from '@/components/ClinicList';
import { generatePromptsV3 } from '@/utils/promptGenerator';
import {
  getClinics, saveClinicScan, savedScanToResult, getScanTexts, historyFromClinic,
} from '@/utils/clinicStorage';
import type { V3SearchInput, ScanSettings, PromptItem, V3AnalysisResult, HistoryRecord, ClinicRecord, SavedScan } from '@/types/v3';

type Step = 'home' | 'input' | 'prompts' | 'loading' | 'results';

interface Progress { done: number; total: number }

export default function Home() {
  const [step, setStep] = useState<Step>('home');
  const [searchInput, setSearchInput] = useState<V3SearchInput | null>(null);
  const [generatedPrompts, setGeneratedPrompts] = useState<PromptItem[]>([]);
  const [result, setResult] = useState<V3AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('AI 엔진 분석 중...');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [clinics, setClinics] = useState<ClinicRecord[]>([]);
  const [isFromSaved, setIsFromSaved] = useState(false);
  const [scanSaved, setScanSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activeScans, setActiveScans] = useState<SavedScan[]>([]);

  useEffect(() => {
    getClinics().then(r => { setClinics(r.clinics); setStorageError(r.error ?? null); });
  }, []);

  // 스캔 경과 시간
  useEffect(() => {
    if (step !== 'loading') return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  const refreshClinics = () => {
    getClinics().then(r => { setClinics(r.clinics); setStorageError(r.error ?? null); });
  };

  const handleInputNext = async (input: V3SearchInput) => {
    setSearchInput(input);
    setLoadingMsg('AI 프롬프트 생성 중...');
    setProgress(null);
    setElapsed(0);
    setStep('loading');

    try {
      const res = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const json = await res.json();
      if (json.success && json.prompts?.length >= 10) {
        setGeneratedPrompts(json.prompts);
      } else {
        setGeneratedPrompts(generatePromptsV3(input.regions, input.treatments));
      }
    } catch {
      setGeneratedPrompts(generatePromptsV3(input.regions, input.treatments));
    }

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
    setSaveError(null);
    setLoadingMsg('AI 엔진 분석 중...');
    setProgress({ done: 0, total: selected.length });
    setElapsed(0);
    setStep('loading');

    try {
      const res = await fetch('/api/analyze-v3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputToUse, selectedPrompts: selected, settings }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        alert('분석 중 오류가 발생했습니다: ' + (json.error ?? res.status));
        setStep('prompts');
        return;
      }

      // SSE 스트림 수신 — 프롬프트 완료마다 진행률이 온다
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let scanResult: V3AnalysisResult | null = null;
      let streamError: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith('data:')) continue;
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.type === 'progress') setProgress({ done: evt.done, total: evt.total });
          else if (evt.type === 'done') scanResult = evt.data;
          else if (evt.type === 'error') streamError = evt.error;
        }
      }

      if (scanResult) {
        setResult(scanResult);
        setHistory(historyForClinic(clinics, scanResult.input.clinicFullName));
        setActiveScans(scansForClinic(clinics, scanResult.input.clinicFullName));
        setStep('results');
      } else {
        alert('분석 중 오류가 발생했습니다: ' + (streamError ?? '알 수 없는 오류'));
        setStep('prompts');
      }
    } catch (e) {
      console.error(e);
      alert('서버와 통신할 수 없습니다.');
      setStep('prompts');
    }
  };

  /** 추이는 저장된 스캔에서 파생한다 (localStorage 누적 안 함) */
  const historyForClinic = (list: ClinicRecord[], fullName: string): HistoryRecord[] => {
    const clinic = list.find(c => c.clinicFullName === fullName);
    return clinic ? historyFromClinic(clinic) : [];
  };

  const scansForClinic = (list: ClinicRecord[], fullName: string): SavedScan[] =>
    list.find(c => c.clinicFullName === fullName)?.scans ?? [];

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

  const handleViewScan = async (scan: SavedScan, clinic: ClinicRecord) => {
    // 응답 원문은 별도 키에 있으므로 열 때 불러온다
    const texts = await getScanTexts(scan.id);
    setResult(savedScanToResult(scan, texts));
    setHistory(historyFromClinic(clinic));
    setActiveScans(clinic.scans);
    setIsFromSaved(true);
    setScanSaved(false);
    setSaveError(null);
    setStep('results');
  };

  const handleSave = async () => {
    if (!result) return;
    setSaveError(null);
    const res = await saveClinicScan(result);
    if (res.ok) {
      setScanSaved(true);
      refreshClinics();
    } else {
      setSaveError(res.error ?? '저장에 실패했습니다.');
    }
  };

  const reset = () => {
    setStep('home');
    setSearchInput(null);
    setGeneratedPrompts([]);
    setResult(null);
    setIsFromSaved(false);
    setScanSaved(false);
    setSaveError(null);
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
          치과전문가가 만든 치과 마케팅
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
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full space-y-4">
              {storageError && (
                <div className="flex items-start gap-3 p-4 rounded-[12px] border border-amber-300 bg-amber-50 text-amber-900 text-sm">
                  <span className="font-bold shrink-0">저장소 연결 실패</span>
                  <span className="text-amber-900/80">{storageError} 저장된 스캔을 불러오거나 새로 저장할 수 없습니다.</span>
                </div>
              )}
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
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-32 space-y-6 w-full">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-4 border-[#d4e9e2] rounded-full" />
                <div className="absolute inset-0 border-4 border-[#00754A] border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <SearchIcon className="w-8 h-8 text-[#006241]" />
                </div>
              </div>
              <div className="text-center w-full max-w-md space-y-3">
                <p className="text-[#006241] font-bold text-xl">{loadingMsg}</p>

                {progress && progress.total > 0 && (
                  <>
                    <div className="h-2 bg-[#e8e8e8] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00754A] rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-sm font-semibold text-black/75">
                      {progress.done} / {progress.total} 프롬프트 완료 · 경과 {elapsed}초
                    </p>
                  </>
                )}

                <p className="text-black/[0.55] text-sm">
                  {loadingMsg === 'AI 프롬프트 생성 중...'
                    ? '병원 정보 기반으로 최적의 롱테일 프롬프트를 생성하고 있습니다.'
                    : 'ChatGPT와 Gemini에 반복 질의 중입니다.'}
                </p>
              </div>
            </motion.div>
          )}

          {/* Results */}
          {step === 'results' && result && (
            <motion.div key="results" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="w-full">
              <V3Dashboard data={result} history={history} savedScans={activeScans} />
              {saveError && (
                <p className="mt-4 text-center text-sm text-[#c82014] font-semibold">{saveError}</p>
              )}
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
