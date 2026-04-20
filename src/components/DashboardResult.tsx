'use client';

import React, { useState, useRef } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { CheckCircle2, XCircle, Search, TrendingUp, Sparkles, Eye, Download } from 'lucide-react';
import type { AnalysisResult } from '@/utils/analyzeMock';
import { motion } from 'framer-motion';
import ResponseModal from './ResponseModal';
import html2canvas from 'html2canvas';

interface DashboardProps {
  data: AnalysisResult;
}

const COLORS = ['#3b82f6', '#334155']; // Vivid Blue for SOV, Deep Slate for others

// Modal state type
interface ModalState {
  isOpen: boolean;
  keyword: string;
  engine: 'chatgpt' | 'gemini';
  mentioned: boolean;
  responseText: string;
}

export default function DashboardResult({ data }: DashboardProps) {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    keyword: '',
    engine: 'chatgpt',
    mentioned: false,
    responseText: '',
  });

  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleDownloadImage = async () => {
    if (!dashboardRef.current) return;
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#020617', // tailwind slate-950
        scale: 3, // higher resolution for professional look
        useCORS: true, 
        allowTaint: false, // set to false when useCORS is true for better security/compatibility
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
      link.download = `다중검색_점유율_리포트_${new Date().toISOString().split('T')[0]}.png`;
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

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  // Do nut chart data
  const pieData = [
    { name: '노출 됨 (우리치과)', value: data.clinicMentions },
    { name: '노출 안됨 (타치과)', value: data.totalSearches - data.clinicMentions }
  ];

  // Bar chart data
  const barData = [
    {
      name: 'ChatGPT',
      노출횟수: data.details.chatgpt.mentions,
      검색횟수: data.details.chatgpt.searches,
    },
    {
      name: 'Gemini',
      노출횟수: data.details.gemini.mentions,
      검색횟수: data.details.gemini.searches,
    }
  ];

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

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm font-semibold mb-4">
            <Sparkles className="w-4 h-4" />
            <span>분석 완료</span>
          </div>
          <h3 className="text-3xl font-extrabold text-white">AI 검색 통합 점유율 리포트</h3>
          <p className="text-slate-400 mt-2">총 <span className="text-blue-400 font-bold">{data.totalSearches}</span>회의 시뮬레이션 기반 분석 결과입니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Left: Overall SOV Donut Chart */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col items-center p-8 bg-slate-800/40 rounded-3xl border border-white/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp className="w-24 h-24" />
            </div>
            <h4 className="text-xl font-bold text-white mb-6 relative z-10">통합 Share of Voice (SOV)</h4>
            <div className="relative w-full h-[300px] z-10">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={85}
                    outerRadius={120}
                    paddingAngle={8}
                    dataKey="value"
                    animationDuration={1500}
                    stroke="transparent"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.5)' }}
                    itemStyle={{ color: '#f8fafc' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center percentage overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-30px]">
                <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-400 to-indigo-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">{data.sovPercentage}%</span>
                <span className="text-sm text-slate-400 font-bold tracking-widest uppercase mt-1">Share</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Engine Comparison Bar Chart */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col items-center p-8 bg-slate-800/40 rounded-3xl border border-white/5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Search className="w-24 h-24" />
            </div>
            <h4 className="text-xl font-bold text-white mb-6 relative z-10">플랫폼별 상세 노출 비교</h4>
            <div className="w-full h-[240px] z-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barData}
                  margin={{ top: 20, right: 30, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 600}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                  <Tooltip 
                    cursor={{fill: '#1e293b'}}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.5)' }}
                  />
                  <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                  <Bar dataKey="검색횟수" fill="#334155" radius={[6, 6, 0, 0]} animationDuration={1000} />
                  <Bar dataKey="노출횟수" fill="#3b82f6" radius={[6, 6, 0, 0]} animationDuration={1000} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 w-full gap-4 mt-6 z-10">
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-emerald-500/20 text-center shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-emerald-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <div className="text-sm font-bold text-emerald-400 relative z-10">ChatGPT SOV</div>
                <div className="text-2xl font-black text-white mt-1 relative z-10">{data.details.chatgpt.sov}%</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-purple-500/20 text-center shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-purple-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                <div className="text-sm font-bold text-purple-400 relative z-10">Gemini SOV</div>
                <div className="text-2xl font-black text-white mt-1 relative z-10">{data.details.gemini.sov}%</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Keyword Detail Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-slate-800/40 p-8 rounded-3xl border border-white/5"
        >
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-bold text-white">롱테일 키워드 스캐닝 로그</h4>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Eye className="w-3.5 h-3.5" />
                <span>아이콘 클릭 → AI 답변 원문 확인</span>
              </div>
              <div className="text-sm text-slate-400 font-medium">총 {data.keywordDetails.length}개의 정밀 프롬프트</div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-900/50">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-slate-400 border-b border-slate-700/50 bg-slate-800/80">
                <tr>
                  <th className="py-4 px-6 font-semibold">검색 프롬프트 (질의문)</th>
                  <th className="py-4 px-6 font-semibold text-center w-48 border-l border-slate-700/50">ChatGPT</th>
                  <th className="py-4 px-6 font-semibold text-center w-48 border-l border-slate-700/50">Gemini</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {data.keywordDetails.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-800/80 transition-colors group">
                    <td className="py-4 px-6 text-slate-300 font-medium truncate max-w-[400px] group-hover:text-white transition-colors" title={item.keyword}>
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></div>
                        {item.keyword}
                      </div>
                    </td>
                    <td className="py-4 px-6 border-l border-slate-700/50 bg-slate-900/30 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <button
                          onClick={() => openModal(item.keyword, 'chatgpt', item.chatgptMentioned, item.chatgptResponseText)}
                          className="group/btn relative p-1 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                          title="ChatGPT 응답 원문 보기"
                        >
                          {item.chatgptMentioned ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)] group-hover/btn:scale-110 transition-transform" />
                          ) : (
                            <XCircle className="w-6 h-6 text-slate-600 group-hover/btn:text-red-400 group-hover/btn:scale-110 transition-all" />
                          )}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 group-hover/btn:w-full h-0.5 bg-emerald-400/50 transition-all rounded-full" />
                        </button>
                        <div 
                          className="text-[12px] text-slate-300 w-full min-w-[180px] max-w-[250px] whitespace-pre-wrap break-words cursor-pointer hover:text-white transition-colors leading-relaxed mt-2"
                          onClick={() => openModal(item.keyword, 'chatgpt', item.chatgptMentioned, item.chatgptResponseText)}
                          title="클릭해서 크게 보기"
                        >
                          {item.chatgptResponseText ? item.chatgptResponseText.replace(/\*/g, '') : '응답 없음'}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 border-l border-slate-700/50 bg-slate-900/30 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <button
                          onClick={() => openModal(item.keyword, 'gemini', item.geminiMentioned, item.geminiResponseText)}
                          className="group/btn relative p-1 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                          title="Gemini 응답 원문 보기"
                        >
                          {item.geminiMentioned ? (
                            <CheckCircle2 className="w-6 h-6 text-purple-400 drop-shadow-[0_0_8px_rgba(167,139,250,0.4)] group-hover/btn:scale-110 transition-transform" />
                          ) : (
                            <XCircle className="w-6 h-6 text-slate-600 group-hover/btn:text-red-400 group-hover/btn:scale-110 transition-all" />
                          )}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 group-hover/btn:w-full h-0.5 bg-purple-400/50 transition-all rounded-full" />
                        </button>
                        <div 
                          className="text-[12px] text-slate-300 w-full min-w-[180px] max-w-[250px] whitespace-pre-wrap break-words cursor-pointer hover:text-white transition-colors leading-relaxed mt-2"
                          onClick={() => openModal(item.keyword, 'gemini', item.geminiMentioned, item.geminiResponseText)}
                          title="클릭해서 크게 보기"
                        >
                          {item.geminiResponseText ? item.geminiResponseText.replace(/\*/g, '') : '응답 없음'}
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

      {/* Response Modal */}
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
