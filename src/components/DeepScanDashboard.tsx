'use client';

import React, { useState, useRef } from 'react';
import { CheckCircle2, XCircle, Repeat, Target, Sparkles, Bot, Zap, Download } from 'lucide-react';
import type { DeepScanResult } from '@/utils/analyzeMock';
import { motion } from 'framer-motion';
import ResponseModal from './ResponseModal';
import html2canvas from 'html2canvas';

interface DeepScanDashboardProps {
  data: DeepScanResult;
}

interface ModalState {
  isOpen: boolean;
  keyword: string;
  engine: 'chatgpt' | 'gemini';
  mentioned: boolean;
  responseText: string;
}

function ConsistencyBadge({ value }: { value: number }) {
  const color = value >= 70 ? 'emerald' : value >= 40 ? 'amber' : 'red';
  const label = value >= 70 ? '높음' : value >= 40 ? '보통' : '낮음';
  const colorClasses = {
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colorClasses[color]}`}>
      {label}
    </span>
  );
}

export default function DeepScanDashboard({ data }: DeepScanDashboardProps) {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false, keyword: '', engine: 'chatgpt', mentioned: false, responseText: '',
  });

  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleDownloadImage = async () => {
    if (!dashboardRef.current) return;
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#020617', // tailwind slate-950
        scale: 3, // higher resolution
        useCORS: true,
        allowTaint: false,
        logging: false,
        onclone: (clonedDoc) => {
          // html2canvas doesn't support backdrop-blur, removing it from clone to prevent failure
          const container = clonedDoc.querySelector('[class*="backdrop-blur"]') as HTMLElement;
          if (container) {
            container.style.backdropFilter = 'none';
            (container.style as unknown as Record<string, string>).webkitBackdropFilter = 'none';
          }
          // Hide all buttons in the screenshot
          const buttons = clonedDoc.querySelectorAll('button');
          buttons.forEach(b => { (b as HTMLElement).style.display = 'none'; });
        }
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `단일정밀_점유율_리포트_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to capture dashboard:', err);
      alert('이미지 저장에 실패했습니다.');
    }
  };

  const openModal = (keyword: string, engine: 'chatgpt' | 'gemini', mentioned: boolean, responseText: string) => {
    setModal({ isOpen: true, keyword, engine, mentioned, responseText });
  };

  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  return (
    <>
      <div 
        ref={dashboardRef}
        className="w-full max-w-5xl mt-12 bg-slate-900/60 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/10 p-8 relative"
      >
        <button 
          onClick={handleDownloadImage}
          className="absolute top-8 right-8 z-20 flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          title="보고서를 이미지로 다운로드"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">이미지 저장</span>
        </button>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm font-semibold mb-4">
            <Target className="w-4 h-4" />
            <span>정밀 분석 완료</span>
          </div>
          <h3 className="text-3xl font-extrabold text-white">단일 키워드 일관성 리포트</h3>
          <p className="text-slate-400 mt-3 max-w-2xl mx-auto leading-relaxed">
            동일한 프롬프트를 <span className="text-amber-400 font-bold">{data.totalAttempts}회</span> 반복 검색하여 
            AI가 <span className="text-blue-400 font-bold">얼마나 일관되게</span> 우리 치과를 추천하는지 측정했습니다.
          </p>
        </div>

        {/* 검색 프롬프트 표시 */}
        <div className="mb-8 p-5 rounded-2xl bg-slate-800/60 border border-white/5">
          <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">분석 대상 프롬프트</div>
          <p className="text-slate-200 text-lg font-medium leading-relaxed">"{data.prompt}"</p>
        </div>

        {/* 일관성 카드 3개 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {/* 통합 일관성 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 bg-slate-800/40 rounded-3xl border border-white/5 text-center relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10"><Repeat className="w-16 h-16" /></div>
            <div className="text-sm font-bold text-slate-400 mb-2">통합 일관성</div>
            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-indigo-400">
              {data.overallConsistency}%
            </div>
            <div className="mt-2"><ConsistencyBadge value={data.overallConsistency} /></div>
            <div className="text-xs text-slate-500 mt-3">{data.totalAttempts * 2}회 중 {data.chatgpt.mentions + data.gemini.mentions}회 노출</div>
          </motion.div>

          {/* ChatGPT 일관성 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 bg-slate-800/40 rounded-3xl border border-emerald-500/10 text-center relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-emerald-400 mb-2">
                <Bot className="w-4 h-4" /> ChatGPT
              </div>
              <div className="text-4xl font-black text-white">{data.chatgpt.consistency}%</div>
              <div className="mt-2"><ConsistencyBadge value={data.chatgpt.consistency} /></div>
              <div className="text-xs text-slate-500 mt-3">{data.totalAttempts}회 중 {data.chatgpt.mentions}회 노출</div>
            </div>
          </motion.div>

          {/* Gemini 일관성 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 bg-slate-800/40 rounded-3xl border border-purple-500/10 text-center relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-purple-500/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-purple-400 mb-2">
                <Sparkles className="w-4 h-4" /> Gemini
              </div>
              <div className="text-4xl font-black text-white">{data.gemini.consistency}%</div>
              <div className="mt-2"><ConsistencyBadge value={data.gemini.consistency} /></div>
              <div className="text-xs text-slate-500 mt-3">{data.totalAttempts}회 중 {data.gemini.mentions}회 노출</div>
            </div>
          </motion.div>
        </div>

        {/* 시도별 상세 테이블 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-800/40 p-8 rounded-3xl border border-white/5"
        >
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              시도별 AI 응답 로그
            </h4>
            <div className="text-sm text-slate-400 font-medium">
              아이콘 클릭 → AI 답변 원문 확인
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-900/50">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400 border-b border-slate-700/50 bg-slate-800/80">
                <tr>
                  <th className="py-4 px-6 font-semibold text-center w-20">#</th>
                  <th className="py-4 px-6 font-semibold text-center w-48 border-l border-slate-700/50">ChatGPT</th>
                  <th className="py-4 px-6 font-semibold text-center w-48 border-l border-slate-700/50">Gemini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.attempts.map((attempt) => (
                  <tr key={attempt.attemptNumber} className="hover:bg-slate-800/80 transition-colors">
                    <td className="py-3 px-6 text-center">
                      <span className="text-slate-500 font-mono text-xs">
                        {String(attempt.attemptNumber).padStart(2, '0')}회
                      </span>
                    </td>
                    <td className="py-3 px-6 border-l border-slate-700/50 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <button
                          onClick={() => openModal(data.prompt, 'chatgpt', attempt.chatgptMentioned, attempt.chatgptResponseText)}
                          className="group/btn relative p-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                          title="ChatGPT 응답 원문 보기"
                        >
                          {attempt.chatgptMentioned ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)] group-hover/btn:scale-110 transition-transform" />
                          ) : (
                            <XCircle className="w-6 h-6 text-slate-600 group-hover/btn:text-red-400 group-hover/btn:scale-110 transition-all" />
                          )}
                        </button>
                        <div 
                          className="text-[12px] text-slate-300 w-full min-w-[180px] max-w-[250px] whitespace-pre-wrap break-words cursor-pointer hover:text-white transition-colors leading-relaxed mt-2 text-center"
                          onClick={() => openModal(data.prompt, 'chatgpt', attempt.chatgptMentioned, attempt.chatgptResponseText)}
                          title="클릭해서 크게 보기"
                        >
                          {attempt.chatgptResponseText ? attempt.chatgptResponseText.replace(/\*/g, '') : '응답 없음'}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-6 border-l border-slate-700/50 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <button
                          onClick={() => openModal(data.prompt, 'gemini', attempt.geminiMentioned, attempt.geminiResponseText)}
                          className="group/btn relative p-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                          title="Gemini 응답 원문 보기"
                        >
                          {attempt.geminiMentioned ? (
                            <CheckCircle2 className="w-6 h-6 text-purple-400 drop-shadow-[0_0_8px_rgba(167,139,250,0.4)] group-hover/btn:scale-110 transition-transform" />
                          ) : (
                            <XCircle className="w-6 h-6 text-slate-600 group-hover/btn:text-red-400 group-hover/btn:scale-110 transition-all" />
                          )}
                        </button>
                        <div 
                          className="text-[12px] text-slate-300 w-full min-w-[180px] max-w-[250px] whitespace-pre-wrap break-words cursor-pointer hover:text-white transition-colors leading-relaxed mt-2 text-center"
                          onClick={() => openModal(data.prompt, 'gemini', attempt.geminiMentioned, attempt.geminiResponseText)}
                          title="클릭해서 크게 보기"
                        >
                          {attempt.geminiResponseText ? attempt.geminiResponseText.replace(/\*/g, '') : '응답 없음'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      <ResponseModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        keyword={modal.keyword}
        engine={modal.engine}
        mentioned={modal.mentioned}
        responseText={modal.responseText}
      />
    </>
  );
}
