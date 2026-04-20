'use client';

import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import { Trophy, TrendingUp, FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { V3AnalysisResult, HistoryRecord, PromptCategory } from '@/types/v3';

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function SovBadge({ value }: { value: number }) {
  const color = value >= 60 ? 'text-emerald-400' : value >= 30 ? 'text-amber-400' : 'text-rose-400';
  return <span className={`text-2xl font-extrabold ${color}`}>{value}%</span>;
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
    name: r.prompt.text.slice(0, 20) + '…',
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
          <Bar dataKey="ChatGPT" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Gemini" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
        <TrendingUp className="w-5 h-5 text-blue-400" />
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
          <Line type="monotone" dataKey="ChatGPT" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Gemini" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="종합" stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} />
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
          <div key={c.name} className="flex items-center gap-3">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              i === 0 ? 'bg-amber-500/20 text-amber-400' :
              i === 1 ? 'bg-slate-500/20 text-slate-300' :
              i === 2 ? 'bg-orange-700/20 text-orange-400' : 'bg-slate-800 text-slate-500'
            }`}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-200 truncate">{c.name}</span>
                <span className="text-sm font-bold text-slate-300 ml-2">{c.percentage}%</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
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
                <p className="text-sm text-slate-300 truncate">{r.prompt.text.slice(0, 60)}…</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gptPct > 0 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                  GPT {gptPct}%
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gemPct > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-500'}`}>
                  GEM {gemPct}%
                </span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 grid md:grid-cols-2 gap-3">
                {[
                  { label: 'ChatGPT', texts: r.chatgpt.responseTexts, color: 'border-green-500/20' },
                  { label: 'Gemini', texts: r.gemini.responseTexts, color: 'border-blue-500/20' },
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

const CATEGORY_ADVICE: Record<PromptCategory, { title: string; strategy: string }> = {
  '지역형': {
    title: '지역 SEO 강화',
    strategy: '구글 마이비즈니스 최신화, 네이버 플레이스 리뷰 관리, 지역명+진료명 조합 블로그 포스팅 (월 4회 이상)',
  },
  '증상형': {
    title: '증상 기반 콘텐츠 제작',
    strategy: '증상→진료 연결 FAQ 페이지 제작, 치료 사례 블로그 (Before/After), 증상별 유튜브 쇼츠 제작',
  },
  '비교형': {
    title: '비교 콘텐츠 & 후기 강화',
    strategy: '가격 투명화 페이지, 치료 전후 비교 갤러리, 네이버 영수증 후기 집중 수집 (월 10건 이상)',
  },
  '추천형': {
    title: '브랜드 신뢰도 구축',
    strategy: '의사 소개 스토리 콘텐츠, 환자 인터뷰 영상, 카카오채널 상담 전환율 개선, 지인 추천 이벤트',
  },
};

function AnalysisReport({ data }: { data: V3AnalysisResult }) {
  const weakPrompts = data.promptResults.filter(r => {
    const gptPct = r.chatgpt.total > 0 ? (r.chatgpt.mentioned / r.chatgpt.total) * 100 : 0;
    const gemPct = r.gemini.total > 0 ? (r.gemini.mentioned / r.gemini.total) * 100 : 0;
    return (gptPct + gemPct) / 2 < 30;
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

  const priorities = (Object.entries(categoryWeakScore) as Array<[PromptCategory, { total: number; weak: number }]>)
    .filter(([, v]) => v.total > 0)
    .map(([cat, v]) => ({
      cat,
      score: v.total > 0 ? Math.round((v.weak / v.total) * 100) : 0,
      ...CATEGORY_ADVICE[cat],
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-6 space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-purple-400" />
        <h3 className="font-bold text-white">AI 콘텐츠 전략 보고서</h3>
      </div>

      {/* Weak Prompts */}
      {weakPrompts.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-rose-300">노출 부족 프롬프트 ({weakPrompts.length}개)</p>
          {weakPrompts.map(r => {
            const gptPct = r.chatgpt.total > 0 ? Math.round((r.chatgpt.mentioned / r.chatgpt.total) * 100) : 0;
            const gemPct = r.gemini.total > 0 ? Math.round((r.gemini.mentioned / r.gemini.total) * 100) : 0;
            return (
              <div key={r.prompt.id} className="bg-rose-500/5 border border-rose-500/15 rounded-xl p-4 space-y-2">
                <p className="text-sm text-slate-300">"{r.prompt.text.slice(0, 80)}…"</p>
                <div className="flex gap-4 text-xs">
                  <span className="text-slate-500">ChatGPT: <span className="text-rose-400 font-bold">{gptPct}%</span></span>
                  <span className="text-slate-500">Gemini: <span className="text-rose-400 font-bold">{gemPct}%</span></span>
                  <span className="text-slate-500">유형: <span className="text-slate-300">{r.prompt.category}</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Priority Strategies */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-300">카테고리별 개선 전략 (우선순위 순)</p>
        {priorities.map((p, i) => (
          <div key={p.cat} className="bg-slate-900/40 border border-white/5 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-rose-500/20 text-rose-400' :
                  i === 1 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'
                }`}>{i + 1}</span>
                <span className="text-sm font-bold text-white">{p.cat} — {p.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">약점 점수</span>
                <span className={`text-sm font-extrabold ${p.score >= 60 ? 'text-rose-400' : p.score >= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {p.score}%
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed pl-8">{p.strategy}</p>
            {/* Score bar */}
            <div className="pl-8">
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${p.score >= 60 ? 'bg-rose-500' : p.score >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${p.score}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Score */}
      <div className="border-t border-white/10 pt-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">종합 AI 가시성 점수</p>
        <div className="text-right">
          <span className={`text-3xl font-extrabold ${
            data.summary.overall.sov >= 60 ? 'text-emerald-400' :
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
  return (
    <div className="w-full space-y-6">
      {/* Scan meta */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-bold text-white">{data.input.clinicFullName}</h2>
          <p className="text-sm text-slate-400">{data.input.regions.join(' · ')} | {data.input.treatments.join(', ')}</p>
        </div>
        <p className="text-xs text-slate-500 bg-slate-800/60 px-3 py-1.5 rounded-full border border-white/10">
          스캔: {formatDate(data.scanDate)}
        </p>
      </div>

      <SummaryCards data={data} />
      <SovBarChart data={data} />
      <HistoryLineChart history={history} current={data} />
      <CompetitorRanking data={data} />
      <PromptDetailTable data={data} />
      <AnalysisReport data={data} />
    </div>
  );
}
