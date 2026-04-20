"use client";

import { useState } from "react";
import SearchForm from "@/components/SearchForm";
import DashboardResult from "@/components/DashboardResult";
import DeepScanDashboard from "@/components/DeepScanDashboard";
import { Activity, Sparkles, MapPin, Search as SearchIcon, Target } from "lucide-react";
import type { AnalysisResult, DeepScanResult } from "@/utils/analyzeMock";
import { motion, AnimatePresence } from "framer-motion";

type ResultMode = 'multi' | 'deep' | null;

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [resultMode, setResultMode] = useState<ResultMode>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
  const [deepScanData, setDeepScanData] = useState<DeepScanResult | null>(null);

  const handleSearch = async (data: { clinicName: string; region: string; treatment: string }) => {
    setIsLoading(true);
    setAnalysisData(null);
    setDeepScanData(null);
    setResultMode(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      const result = await res.json();
      
      if (result.success) {
        setAnalysisData(result.data);
        setResultMode('multi');
      } else {
        alert("분석 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error(error);
      alert("서버와 통신할 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeepScan = async (data: { clinicName: string; region: string; treatment: string; prompt: string; repeatCount: number }) => {
    setIsLoading(true);
    setAnalysisData(null);
    setDeepScanData(null);
    setResultMode(null);

    try {
      const res = await fetch("/api/deep-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      const result = await res.json();
      
      if (result.success) {
        setDeepScanData(result.data);
        setResultMode('deep');
      } else {
        alert("정밀 분석 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error(error);
      alert("서버와 통신할 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-[family-name:var(--font-geist-sans)] pb-32 text-slate-100 overflow-hidden relative">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/30 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-600/20 blur-[150px] pointer-events-none" />
      
      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-sm">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="bg-gradient-to-tr from-blue-500 to-indigo-500 p-2 rounded-xl shadow-lg shadow-blue-500/20">
            <Activity className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            닥터원츠 <span className="text-blue-400">GEO</span> 프로그램
          </h1>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10"
        >
          <Sparkles className="w-4 h-4 text-blue-400" />
          마케팅 대행사용 AI 점유율 분석 스캐너
        </motion.div>
      </header>

      {/* Hero & Search Form */}
      <main className="max-w-6xl mx-auto px-6 pt-24 pb-12 flex flex-col items-center relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-semibold mb-2">
            <MapPin className="w-4 h-4" />
            <span>실제 환자들의 로컬 검색점유율 분석</span>
          </div>
          <h2 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
            치과 AI 플랫폼 검색 장악력을 <br className="hidden md:block"/> 
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              한눈에 확인하세요
            </span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            치과명, 지역, 진료명을 입력하면 ChatGPT와 Gemini를 통해 실제 잠재 환자가 검색할 법한 다양한 롱테일 키워드로 시뮬레이션을 진행하여 실시간 점유율(SOV)을 분석합니다.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full"
        >
          <SearchForm onSubmit={handleSearch} onDeepScan={handleDeepScan} isLoading={isLoading} />
        </motion.div>

        {/* Dashboard Results or Placeholder */}
        <AnimatePresence mode="wait">
          {resultMode === 'multi' && analysisData ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.2 }}
              className="w-full mt-16"
            >
              <DashboardResult data={analysisData} />
            </motion.div>
          ) : resultMode === 'deep' && deepScanData ? (
            <motion.div
              key="deepscan"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.2 }}
              className="w-full mt-16"
            >
              <DeepScanDashboard data={deepScanData} />
            </motion.div>
          ) : (
            <motion.div 
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-16 w-full max-w-5xl h-[400px] border border-white/10 rounded-3xl flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-sm relative overflow-hidden"
            >
              {isLoading ? (
                <div className="flex flex-col items-center z-10">
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <SearchIcon className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                  <p className="text-blue-400 font-bold text-xl tracking-tight">AI 엔진 분석 중...</p>
                  <p className="text-slate-400 mt-2 text-sm max-w-sm text-center">
                    수십 개의 롱테일 키워드를 생성하고 ChatGPT와 Gemini 플랫폼에서의 가시성을 스캔하고 있습니다.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center z-10 opacity-60">
                  <Activity className="w-16 h-16 text-slate-600 mb-6" />
                  <p className="text-slate-400 font-medium text-lg">검색을 완료하면 이곳에 프리미엄 분석 리포트가 표시됩니다.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
