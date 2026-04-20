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
                <p className="text-sm text-slate-300 truncate">{(r.prompt.displayText ?? r.prompt.text).slice(0, 60)}…</p>
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
        <FileText className="w-5 h-5 text-purple-400" />
        <h3 className="font-bold text-white">AI 콘텐츠 전략 보고서</h3>
        <span className="text-xs text-slate-500 ml-auto">미노출 역분석 + 블로그 제안</span>
      </div>

      {weakPrompts.length === 0 ? (
        <div className="text-center py-6 text-emerald-400 font-semibold text-sm">
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
                      r.prompt.category === '지역형' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
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
                      <p className="text-xs font-bold text-purple-300 uppercase tracking-wide">추천 블로그 콘텐츠</p>
                      {analysis.blogs.map((b, i) => (
                        <div key={i} className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
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
                <span className={`text-xs font-bold w-8 text-right ${score >= 60 ? 'text-rose-400' : score >= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
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
