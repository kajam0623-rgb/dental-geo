'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { Trophy, TrendingUp, FileText, ChevronDown, ChevronUp, Download } from 'lucide-react';
import type { V3AnalysisResult, HistoryRecord, PromptCategory } from '@/types/v3';

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function SovBadge({ value }: { value: number }) {
  const color = value >= 60 ? 'text-[#00a000]' : value >= 30 ? 'text-amber-400' : 'text-rose-400';
  return <span className={`text-2xl font-extrabold ${color}`}>{value}%</span>;
}

// ─── SOV Donut Gauge ────────────────────────────────────────────

function SovGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(value / 100, 1) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#1e293b" strokeWidth="13" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="13"
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 65 65)" style={{ transition: 'stroke-dasharray 0.8s ease' }} />
        <text x="65" y="60" textAnchor="middle" fill="white" fontSize="22" fontWeight="800">{value}%</text>
        <text x="65" y="78" textAnchor="middle" fill="#94a3b8" fontSize="10">SOV</text>
      </svg>
      <p className="text-xs font-semibold text-slate-400">{label}</p>
    </div>
  );
}

function GaugeSection({ data }: { data: V3AnalysisResult }) {
  const overallColor = data.summary.overall.sov >= 60 ? '#10b981' : data.summary.overall.sov >= 30 ? '#f59e0b' : '#f43f5e';
  const gptColor = data.summary.chatgpt.sov >= 60 ? '#10b981' : data.summary.chatgpt.sov >= 30 ? '#f59e0b' : '#f43f5e';
  const gemColor = data.summary.gemini.sov >= 60 ? '#10b981' : data.summary.gemini.sov >= 30 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
        <SovGauge value={data.summary.overall.sov} label="종합" color={overallColor} />
        <div className="hidden sm:block w-px h-28 bg-white/10" />
        <SovGauge value={data.summary.chatgpt.sov} label="ChatGPT" color={gptColor} />
        <SovGauge value={data.summary.gemini.sov} label="Gemini" color={gemColor} />
        <div className="hidden sm:block w-px h-28 bg-white/10" />
        <div className="text-center space-y-1">
          <p className="text-xs text-slate-500">스캔 일시</p>
          <p className="text-sm font-bold text-white">{formatDate(data.scanDate)}</p>
          <p className="text-xs text-slate-500 mt-2">총 스캔 횟수</p>
          <p className="text-sm font-bold text-white">{data.summary.chatgpt.total + data.summary.gemini.total}회</p>
          <p className="text-xs text-slate-500 mt-2">엔진 일치율</p>
          <p className="text-sm font-bold text-white">{data.summary.agreementRate}%</p>
        </div>
      </div>
    </div>
  );
}

// ─── SOV Summary Cards ──────────────────────────────────────────

function SummaryCards({ data }: { data: V3AnalysisResult }) {
  const { summary } = data;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: '종합 SOV', value: summary.overall.sov, sub: `총 ${summary.chatgpt.total + summary.gemini.total}회 스캔` },
        { label: 'ChatGPT SOV', value: summary.chatgpt.sov, sub: `${summary.chatgpt.mentions} / ${summary.chatgpt.total}회 언급` },
        { label: 'Gemini SOV', value: summary.gemini.sov, sub: `${summary.gemini.mentions} / ${summary.gemini.total}회 언급` },
        { label: '엔진 일치율', value: summary.agreementRate, sub: '두 엔진 동의 비율' },
      ].map(c => (
        <div key={c.label} className="bg-slate-800/60 border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
          <p className="text-xs text-slate-400 font-medium">{c.label}</p>
          <SovBadge value={c.value} />
          <p className="text-xs text-slate-500">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Bar Chart ──────────────────────────────────────────────────

function SovBarChart({ data }: { data: V3AnalysisResult }) {
  const chartData = data.promptResults.map(r => ({
    name: (r.prompt.displayText ?? r.prompt.text).slice(0, 20) + '…',
    ChatGPT: r.chatgpt.total > 0 ? Math.round((r.chatgpt.mentioned / r.chatgpt.total) * 100) : 0,
    Gemini: r.gemini.total > 0 ? Math.round((r.gemini.mentioned / r.gemini.total) * 100) : 0,
    category: r.prompt.category,
  }));

  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">프롬프트별 노출율 (ChatGPT vs Gemini)</h3>
        <p className="text-xs text-slate-500">{formatDate(data.scanDate)} 기준</p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
            labelStyle={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: 4 }}
            formatter={(v: unknown) => [`${v}%`]}
          />
          <Legend wrapperStyle={{ color: '#94a3b8', paddingTop: 8 }} />
          <Bar dataKey="ChatGPT" fill="#FF8C00" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Gemini" fill="#FFD700" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Line Chart (History) ────────────────────────────────────────

function HistoryLineChart({ history, current }: { history: HistoryRecord[]; current: V3AnalysisResult }) {
  const currentRecord: HistoryRecord = {
    scanDate: current.scanDate,
    clinicFullName: current.input.clinicFullName,
    clinicShortName: current.input.clinicShortName,
    chatgptSov: current.summary.chatgpt.sov,
    geminiSov: current.summary.gemini.sov,
    overallSov: current.summary.overall.sov,
  };

  const allRecords = [...history.slice(-9), currentRecord];
  const chartData = allRecords.map(r => ({
    date: new Date(r.scanDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
    ChatGPT: r.chatgptSov,
    Gemini: r.geminiSov,
    종합: r.overallSov,
  }));

  if (chartData.length < 2) {
    return (
      <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6 flex items-center justify-center h-48">
        <p className="text-slate-500 text-sm">2회 이상 스캔하면 추이 그래프가 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-[#00a000]" />
        <h3 className="font-bold text-white">날짜별 SOV 추이</h3>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
            formatter={(v: unknown) => [`${v}%`]}
          />
          <Legend wrapperStyle={{ color: '#94a3b8' }} />
          <Line type="monotone" dataKey="ChatGPT" stroke="#FF8C00" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Gemini" stroke="#FFD700" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="종합" stroke="#39FF14" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Competitor Ranking ─────────────────────────────────────────

function CompetitorRanking({ data }: { data: V3AnalysisResult }) {
  if (data.competitorRankings.length === 0) return null;

  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h3 className="font-bold text-white">경쟁사 AI 노출 랭킹</h3>
        <span className="text-xs text-slate-500 ml-auto">AI 대화에서 가장 많이 언급된 브랜드</span>
      </div>
      <div className="space-y-2">
        {data.competitorRankings.map((c, i) => (
          <div key={c.name} className={`flex items-center gap-3 rounded-xl px-2 py-1 ${c.isTarget ? 'bg-amber-500/10 border border-amber-500/30' : ''}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              i === 0 ? 'bg-amber-500/20 text-amber-400' :
              i === 1 ? 'bg-slate-500/20 text-slate-300' :
              i === 2 ? 'bg-orange-700/20 text-orange-400' : 'bg-slate-800 text-slate-500'
            }`}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-sm font-medium truncate ${c.isTarget ? 'text-amber-300 font-bold' : 'text-slate-200'}`}>{c.name}</span>
                  {c.isTarget && (
                    <span className="flex-shrink-0 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">우리 병원</span>
                  )}
                </div>
                <span className="text-sm font-bold text-slate-300 ml-2">{c.percentage}%</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${c.isTarget ? 'bg-gradient-to-r from-amber-400 to-yellow-500' : 'bg-gradient-to-r from-[#006400] to-black'}`}
                  style={{ width: `${Math.min(c.percentage * 2, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Prompt Overview Table (O/X 한눈에) ─────────────────────────

function PromptOverviewTable({ data }: { data: V3AnalysisResult }) {
  const pct = (mentioned: number, total: number) =>
    total > 0 ? Math.round((mentioned / total) * 100) : 0;

  const cell = (p: number) => {
    const bg = p >= 50 ? 'bg-emerald-500/20 text-emerald-300' : p > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/15 text-rose-400';
    const label = p >= 50 ? '●' : p > 0 ? '△' : '✕';
    return { bg, label, p };
  };

  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6 space-y-4">
      <h3 className="font-bold text-white">전체 프롬프트 결과 한눈에 보기</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs text-slate-400 font-semibold">
              <th className="text-left pb-3 pr-4 w-8">#</th>
              <th className="text-left pb-3 pr-4">프롬프트</th>
              <th className="text-left pb-3 pr-3 w-20">유형</th>
              <th className="text-center pb-3 px-3 w-24">ChatGPT</th>
              <th className="text-center pb-3 px-3 w-24">Gemini</th>
              <th className="text-center pb-3 pl-3 w-20">평균</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.promptResults.map((r, i) => {
              const gpt = cell(pct(r.chatgpt.mentioned, r.chatgpt.total));
              const gem = cell(pct(r.gemini.mentioned, r.gemini.total));
              const avg = Math.round((gpt.p + gem.p) / 2);
              const avgCell = cell(avg);
              return (
                <tr key={r.prompt.id} className="hover:bg-white/[0.02] transition">
                  <td className="py-3 pr-4 text-slate-500 text-xs">{i + 1}</td>
                  <td className="py-3 pr-4">
                    <p className="text-slate-300 text-xs leading-snug line-clamp-2">
                      {r.prompt.displayText ?? r.prompt.text}
                    </p>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.prompt.category === '지역형' ? 'bg-[#006400]/15 text-[#00a000]' :
                      r.prompt.category === '증상형' ? 'bg-rose-500/15 text-rose-300' :
                      r.prompt.category === '비교형' ? 'bg-amber-500/15 text-amber-300' :
                      'bg-emerald-500/15 text-emerald-300'
                    }`}>{r.prompt.category}</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${gpt.bg}`}>
                      {gpt.label} {gpt.p}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${gem.bg}`}>
                      {gem.label} {gem.p}%
                    </span>
                  </td>
                  <td className="py-3 pl-3 text-center">
                    <span className={`text-xs font-extrabold ${avgCell.p >= 50 ? 'text-[#00a000]' : avgCell.p > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {avg}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 pt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="text-[#00a000]">●</span> 50% 이상</span>
        <span className="flex items-center gap-1"><span className="text-amber-400">△</span> 1~49%</span>
        <span className="flex items-center gap-1"><span className="text-rose-400">✕</span> 0%</span>
      </div>
    </div>
  );
}

// ─── Prompt Detail Table ────────────────────────────────────────

function PromptDetailTable({ data }: { data: V3AnalysisResult }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6 space-y-3">
      <h3 className="font-bold text-white">프롬프트별 상세 결과</h3>
      {data.promptResults.map(r => {
        const gptPct = r.chatgpt.total > 0 ? Math.round((r.chatgpt.mentioned / r.chatgpt.total) * 100) : 0;
        const gemPct = r.gemini.total > 0 ? Math.round((r.gemini.mentioned / r.gemini.total) * 100) : 0;
        const isOpen = expanded === r.prompt.id;

        return (
          <div key={r.prompt.id} className="border border-white/5 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-4 hover:bg-slate-700/30 transition text-left"
              onClick={() => setExpanded(isOpen ? null : r.prompt.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">{(r.prompt.displayText ?? r.prompt.text).slice(0, 60)}…</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gptPct > 0 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                  GPT {gptPct}%
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gemPct > 0 ? 'bg-black/30 text-slate-300' : 'bg-slate-700 text-slate-500'}`}>
                  GEM {gemPct}%
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 grid md:grid-cols-2 gap-3">
                {[
                  { label: 'ChatGPT', texts: r.chatgpt.responseTexts, color: 'border-green-500/20' },
                  { label: 'Gemini', texts: r.gemini.responseTexts, color: 'border-black/30' },
                ].map(e => (
                  <div key={e.label} className={`border ${e.color} rounded-xl p-3 space-y-2`}>
                    <p className="text-xs font-bold text-slate-400">{e.label} 응답 ({e.texts.length}회)</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {e.texts.map((t, i) => (
                        <p key={i} className="text-xs text-slate-400 bg-slate-900/50 rounded-lg p-2 leading-relaxed">{t.slice(0, 200)}{t.length > 200 ? '…' : ''}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── AI Report ──────────────────────────────────────────────────

interface WeakAnalysis {
  reason: string;
  blogs: Array<{ title: string; platform: string; tip: string }>;
}

function analyzeWeakPrompt(
  displayText: string,
  category: PromptCategory,
  regions: string[],
  treatments: string[],
): WeakAnalysis {
  const r = regions[0] ?? '';
  const t = treatments[0] ?? '';
  const hasPrice  = /가격|비용|합리|저렴|얼마/.test(displayText);
  const hasNight  = /야간|저녁|직장인|퇴근/.test(displayText);
  const hasPost   = /후|다음|지나/.test(displayText) && /통증|관리|주의/.test(displayText);
  const hasSymptom = /흔들|시리|아프|불편|통증|붓/.test(displayText);
  const hasCompare = /비교|차이|vs|어디가 좋|어느 곳/.test(displayText);

  if (category === '지역형') {
    if (hasPrice) return {
      reason: `"${r} + ${t} + 가격" 조합의 콘텐츠가 AI 학습 데이터에 없습니다. AI는 공개된 가격 정보가 있는 병원을 우선 추천하므로, 이 병원의 가격 정보가 온라인에 전혀 노출되지 않아 0% 결과가 나왔습니다.`,
      blogs: [
        { title: `[${r}] ${t} 가격 총정리 — 치료 범위별 비용 완전 공개`, platform: '네이버 블로그', tip: '실제 치료 단계별 비용을 표로 정리, "숨김 비용 없음" 강조' },
        { title: `${t} 비용이 병원마다 왜 다를까? ${r} 원장이 직접 설명합니다`, platform: '티스토리', tip: '원인 설명 + 우리 병원 기준 공개 → 신뢰도 UP' },
        { title: `${r} ${t} 합리적 가격 치과 고르는 법 — 체크리스트 5가지`, platform: '네이버 블로그', tip: '체크리스트 형식으로 작성, 우리 병원이 모든 항목 충족임을 자연스럽게 노출' },
      ],
    };
    if (hasNight) return {
      reason: `"야간 진료 + ${t}" 키워드를 연결하는 콘텐츠가 없습니다. AI는 진료 시간이 명시된 콘텐츠를 참조하는데, 해당 병원의 공식 채널 어디에도 야간 운영 정보가 없어 노출이 불가능한 상태입니다.`,
      blogs: [
        { title: `직장인을 위한 ${r} 야간 ${t} 치과 — 예약부터 치료까지`, platform: '네이버 블로그', tip: '진료 시간표 이미지 삽입, "평일 ○시까지 진료" 제목에 포함' },
        { title: `퇴근 후 ${t}? ${r} 저녁 진료 치과 완전 가이드`, platform: '카카오뷰', tip: '직장인 페르소나로 작성, 지하철역 도보 몇 분 등 접근성 강조' },
        { title: `${r} 직장인 ${t} 후기 — 평일 저녁 치료 경험 공유`, platform: '네이버 블로그', tip: '실제 환자 후기 형태로 야간 접수 편의성 자연스럽게 언급' },
      ],
    };
    return {
      reason: `"${r} + ${t}" 키워드 조합의 공식 콘텐츠가 절대적으로 부족합니다. 경쟁 병원들은 해당 지역+진료명 조합으로 블로그·리뷰가 다수 인덱싱되어 있어 AI가 그 병원들을 먼저 학습한 상태입니다.`,
      blogs: [
        { title: `${r} ${t} 잘하는 치과 고르는 법 — 원장이 알려주는 5가지 기준`, platform: '네이버 블로그', tip: '제목에 지역명+진료명 포함 필수, 비교 콘텐츠로 신뢰감 형성' },
        { title: `[${r} 원장 칼럼] ${t}, 이것만 알고 시작하세요`, platform: '티스토리', tip: '의학적 정보 + 우리 병원 특장점을 자연스럽게 연결' },
        { title: `${r} ${t} 후기 — 치료 전 과정을 솔직하게 공개합니다`, platform: '네이버 블로그', tip: '단계별 사진 포함, Before/After로 결과 명확히 제시' },
      ],
    };
  }

  if (category === '증상형') {
    if (hasPost) return {
      reason: `"${t} 시술 후 관리·통증" 관련 사후 케어 콘텐츠가 전무합니다. AI는 시술 후 환자 경험을 다루는 병원을 전문가로 인식하는데, 이 병원은 시술 후 정보를 제공하는 콘텐츠가 없어 추천 대상에서 제외됩니다.`,
      blogs: [
        { title: `${t} 후 주의사항 완벽 가이드 — ${r} 원장이 직접 작성`, platform: '네이버 블로그', tip: '1~4주 회복 단계별 주의사항을 표로 정리, 전문성 강조' },
        { title: `${t} 시술 후 통증, 정상인가요? 케어 방법 총정리`, platform: '티스토리', tip: '"언제 병원을 다시 와야 하나" Q&A 포함 → 재방문 유도 효과도 있음' },
        { title: `${t} 치료 후 회복 일지 — 실제 환자의 1개월 경험 공유`, platform: '네이버 블로그', tip: '날짜별 회복 과정 공유, 공감 유발 → 신뢰도·공유율 UP' },
      ],
    };
    if (hasSymptom) return {
      reason: `증상 키워드와 "${t}" 치료를 연결하는 콘텐츠가 없습니다. 환자들은 증상으로 검색하고 AI가 그것을 해결할 병원을 추천하는데, 이 병원은 증상→치료 연결 콘텐츠가 없어 AI 학습 데이터에 포함되지 않았습니다.`,
      blogs: [
        { title: `치아가 흔들릴 때 ${t}가 해답일까요? — ${r} 원장의 정직한 답변`, platform: '네이버 블로그', tip: '증상 설명 → 진단 → 치료 흐름으로 작성, 공포증 해소 콘텐츠로 구성' },
        { title: `${t} 필요한 5가지 증상 — 지금 내 상태 셀프 체크`, platform: '티스토리', tip: '체크리스트로 자가 진단 유도, CTA로 "무료 상담 예약" 연결' },
        { title: `${r} 원장이 알려주는 ${t} 적합 케이스 — 실제 사례 분석`, platform: '네이버 블로그', tip: '익명 환자 사례 3개 이상 포함, 비슷한 증상의 독자 공감 유도' },
      ],
    };
    return {
      reason: `환자 관점의 증상→치료 연결 콘텐츠가 없어 AI가 이 병원을 해당 케이스의 전문가로 인식하지 못합니다.`,
      blogs: [
        { title: `이런 증상이면 ${t} 필요합니다 — ${r} 치과 원장 진단`, platform: '네이버 블로그', tip: '증상 체크리스트 + 치료 필요성 자연스럽게 연결' },
        { title: `${t} 전 꼭 알아야 할 것들 — 환자 FAQ 20선`, platform: '티스토리', tip: '실제 환자가 많이 묻는 질문 위주로, 긴 체류시간 유도' },
        { title: `${r} 원장의 ${t} 케이스 스터디 — 치료 전후 비교`, platform: '네이버 블로그', tip: 'Before/After 사진 필수, 결과 중심으로 작성' },
      ],
    };
  }

  if (category === '비교형') return {
    reason: `가격·장비·전문의 등 비교 가능한 객관적 정보가 공개된 채널에 없습니다. AI는 비교 검색에서 데이터가 풍부한 병원을 선택하는데, 이 병원은 비교 근거 콘텐츠가 없어 AI가 선택 대상으로 포함하지 않았습니다.`,
    blogs: [
      { title: `${r} ${t} 치과 비교 — 가격·장비·경력 직접 공개합니다`, platform: '네이버 블로그', tip: '타 병원과 직접 비교 대신 "우리 병원 기준" 수치 공개로 간접 비교 유도' },
      { title: `${t} 치과 선택 전 꼭 물어봐야 할 질문 5가지 (원장 직접 답변)`, platform: '티스토리', tip: '소비자가 비교할 때 중요한 항목 중심, 우리 병원이 모두 충족함을 자연스럽게 제시' },
      { title: `다른 치과와 비교해보세요 — 우리 병원 ${t} 차별점 3가지`, platform: '카카오뷰', tip: '솔직하고 투명한 톤으로 작성, 신뢰 형성에 효과적' },
    ],
  };

  // 추천형
  return {
    reason: `AI가 "신뢰할 수 있는 추천" 대상으로 이 병원을 선택하지 않습니다. 원장 전문성·환자 신뢰를 입증할 수 있는 콘텐츠(수상경력, 논문, 후기 누적 등)가 온라인에서 확인이 안 되거나 경쟁 병원에 비해 절대적으로 부족합니다.`,
    blogs: [
      { title: `원장 소개 — ${t} 전문의가 되기까지의 이야기`, platform: '네이버 블로그', tip: '학력·경력보다 "왜 이 진료에 집중하게 됐는지" 스토리 중심으로 공감 유도' },
      { title: `${r} 환자들이 우리 치과를 선택한 이유 — 실제 후기 모음`, platform: '네이버 블로그', tip: '구글·네이버 리뷰 인용 + 원장 직접 답변 형태로 신뢰도 극대화' },
      { title: `처음 방문하는 분들을 위한 ${r} 치과 상담 안내`, platform: '카카오뷰', tip: '첫 방문 불안감 해소 중심, 상담 예약 CTA로 마무리' },
    ],
  };
}

function AnalysisReport({ data }: { data: V3AnalysisResult }) {
  const [openId, setOpenId] = useState<string | null>(null);

  const weakPrompts = data.promptResults.filter(r => {
    const avg = ((r.chatgpt.mentioned / (r.chatgpt.total || 1)) + (r.gemini.mentioned / (r.gemini.total || 1))) / 2 * 100;
    return avg < 30;
  });

  const categoryWeakScore: Record<PromptCategory, { total: number; weak: number }> = {
    '지역형': { total: 0, weak: 0 },
    '증상형': { total: 0, weak: 0 },
    '비교형': { total: 0, weak: 0 },
    '추천형': { total: 0, weak: 0 },
  };
  data.promptResults.forEach(r => {
    const cat = r.prompt.category;
    categoryWeakScore[cat].total++;
    const avg = ((r.chatgpt.mentioned / (r.chatgpt.total || 1)) + (r.gemini.mentioned / (r.gemini.total || 1))) / 2 * 100;
    if (avg < 30) categoryWeakScore[cat].weak++;
  });

  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6 space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-[#00a000]" />
        <h3 className="font-bold text-white">AI 콘텐츠 전략 보고서</h3>
        <span className="text-xs text-slate-500 ml-auto">미노출 역분석 + 블로그 제안</span>
      </div>

      {weakPrompts.length === 0 ? (
        <div className="text-center py-6 text-[#00a000] font-semibold text-sm">
          모든 프롬프트에서 30% 이상 노출 — 우수한 AI 가시성입니다.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-rose-300">
            노출 부족 프롬프트 ({weakPrompts.length}개) — 클릭하면 원인 분석 + 블로그 제안 확인
          </p>

          {weakPrompts.map(r => {
            const gptPct = r.chatgpt.total > 0 ? Math.round((r.chatgpt.mentioned / r.chatgpt.total) * 100) : 0;
            const gemPct = r.gemini.total > 0 ? Math.round((r.gemini.mentioned / r.gemini.total) * 100) : 0;
            const isOpen = openId === r.prompt.id;
            const analysis = analyzeWeakPrompt(
              r.prompt.displayText ?? r.prompt.text,
              r.prompt.category,
              data.input.regions,
              data.input.treatments,
            );

            return (
              <div key={r.prompt.id} className="border border-rose-500/20 rounded-2xl overflow-hidden">
                {/* Header — clickable */}
                <button
                  className="w-full text-left p-4 bg-rose-500/5 hover:bg-rose-500/10 transition space-y-2"
                  onClick={() => setOpenId(isOpen ? null : r.prompt.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-200 leading-relaxed flex-1">
                      "{r.prompt.displayText ?? r.prompt.text}"
                    </p>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-slate-500">ChatGPT <span className={`font-bold ${gptPct > 0 ? 'text-amber-400' : 'text-rose-400'}`}>{gptPct}%</span></span>
                    <span className="text-slate-500">Gemini <span className={`font-bold ${gemPct > 0 ? 'text-amber-400' : 'text-rose-400'}`}>{gemPct}%</span></span>
                    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${
                      r.prompt.category === '지역형' ? 'bg-[#006400]/10 text-[#00a000] border-[#006400]/20' :
                      r.prompt.category === '증상형' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' :
                      r.prompt.category === '비교형' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    }`}>{r.prompt.category}</span>
                  </div>
                </button>

                {/* Expanded analysis */}
                {isOpen && (
                  <div className="p-4 space-y-4 bg-slate-900/40">
                    {/* 원인 분석 */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold text-rose-300 uppercase tracking-wide">미노출 원인 분석</p>
                      <p className="text-sm text-slate-300 leading-relaxed bg-rose-500/5 border border-rose-500/10 rounded-xl p-3">
                        {analysis.reason}
                      </p>
                    </div>

                    {/* 블로그 제안 */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#00a000] uppercase tracking-wide">추천 블로그 콘텐츠</p>
                      {analysis.blogs.map((b, i) => (
                        <div key={i} className="bg-black/20 border border-[#006400]/15 rounded-xl p-3 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#006400]/30 text-[#00a000] text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-semibold text-white leading-snug">"{b.title}"</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{b.platform}</span>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">💡 {b.tip}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Category weakness summary */}
      <div className="space-y-2 border-t border-white/10 pt-4">
        <p className="text-sm font-semibold text-slate-300">카테고리별 약점 요약</p>
        {(Object.entries(categoryWeakScore) as Array<[PromptCategory, { total: number; weak: number }]>)
          .filter(([, v]) => v.total > 0)
          .sort(([, a], [, b]) => (b.weak / b.total) - (a.weak / a.total))
          .map(([cat, v]) => {
            const score = Math.round((v.weak / v.total) * 100);
            return (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-14">{cat}</span>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${score >= 60 ? 'bg-rose-500' : score >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${score}%` }} />
                </div>
                <span className={`text-xs font-bold w-8 text-right ${score >= 60 ? 'text-rose-400' : score >= 30 ? 'text-amber-400' : 'text-[#00a000]'}`}>
                  {score}%
                </span>
              </div>
            );
          })}
      </div>

      {/* Overall Score */}
      <div className="border-t border-white/10 pt-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">종합 AI 가시성 점수</p>
        <div className="text-right">
          <span className={`text-3xl font-extrabold ${
            data.summary.overall.sov >= 60 ? 'text-[#00a000]' :
            data.summary.overall.sov >= 30 ? 'text-amber-400' : 'text-rose-400'
          }`}>{data.summary.overall.sov}</span>
          <span className="text-slate-400 text-lg font-bold"> / 100</span>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.summary.overall.sov >= 60 ? '우수 — 경쟁 우위 유지 중' :
             data.summary.overall.sov >= 30 ? '보통 — 콘텐츠 보강 필요' : '미흡 — 즉각적인 GEO 최적화 필요'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main V3 Dashboard ──────────────────────────────────────────

interface V3DashboardProps {
  data: V3AnalysisResult;
  history: HistoryRecord[];
}

export default function V3Dashboard({ data, history }: V3DashboardProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const handleSavePng = useCallback(async () => {
    if (!printRef.current) return;
    setSaving(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(printRef.current, {
        backgroundColor: '#0f172a',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `GEO리포트_${data.input.clinicFullName}_${new Date(data.scanDate).toLocaleDateString('ko-KR')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('PNG 저장 실패: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }, [data.input.clinicFullName, data.scanDate]);

  return (
    <div className="w-full space-y-6">
      {/* Header + PNG button */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-bold text-white">{data.input.clinicFullName}</h2>
          <p className="text-sm text-slate-400">{data.input.regions.join(' · ')} | {data.input.treatments.join(', ')}</p>
        </div>
        <button
          onClick={handleSavePng}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-sm font-semibold text-slate-300 hover:text-white transition disabled:opacity-50 disabled:pointer-events-none"
        >
          <Download className="w-4 h-4" />
          {saving ? '저장 중...' : 'PNG 저장'}
        </button>
      </div>

      {/* Capture area */}
      <div ref={printRef} className="space-y-6">

        <GaugeSection data={data} />
        <SovBarChart data={data} />
        <PromptOverviewTable data={data} />
        <HistoryLineChart history={history} current={data} />
        <CompetitorRanking data={data} />
        <PromptDetailTable data={data} />
        <AnalysisReport data={data} />
      </div>
    </div>
  );
}
