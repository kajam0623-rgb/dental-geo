'use client';

import React from 'react';
import { CalendarClock, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import type { MonthlyReport as Report } from '@/utils/monthlyReport';

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function DeltaPill({ delta, unit }: { delta: number | null; unit: string }) {
  if (delta === null) return <span className="text-xs text-black/40">비교 불가</span>;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-black/[0.55]">
        <Minus className="w-3 h-3" /> 변화 없음
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold ${up ? 'text-[#006241]' : 'text-[#c82014]'}`}>
      {up ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
      {up ? '+' : ''}{delta}{unit}
    </span>
  );
}

function Chips({ items, tone }: { items: string[]; tone: 'good' | 'bad' | 'neutral' }) {
  const cls =
    tone === 'good' ? 'bg-[#d4e9e2] text-[#006241] border-[#006241]/20'
    : tone === 'bad' ? 'bg-rose-50 text-[#c82014] border-rose-200'
    : 'bg-[#edebe9] text-black/[0.65] border-black/[0.06]';
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={i} className={`text-xs px-2.5 py-1 rounded-full border ${cls}`}>{t}</span>
      ))}
    </div>
  );
}

/**
 * 대행사가 매달 원장에게 내미는 한 장.
 * "지난달 대비 무엇이 좋아졌고 무엇이 나빠졌는가"만 남긴다.
 */
export default function MonthlyReport({ report }: { report: Report }) {
  const r = report;
  const hasCompetitorMoves = r.risingCompetitors.length > 0 || r.fallingCompetitors.length > 0;
  const hasCitationMoves = r.newCitations.length > 0 || r.lostCitations.length > 0;
  const hasKeywordMoves = r.fixedKeywords.length > 0 || r.newWeakKeywords.length > 0;

  return (
    <div
      className="bg-white rounded-[12px] p-6 space-y-5"
      style={{ boxShadow: '0 0 0.5px rgba(0,0,0,0.14), 0 1px 1px rgba(0,0,0,0.24)' }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarClock className="w-5 h-5 text-[#006241]" />
        <h3 className="font-bold text-[#1E3932]" style={{ letterSpacing: '-0.16px' }}>월간 변화 리포트</h3>
        <span className="text-xs text-black/40 ml-auto">
          {fmt(r.previousDate)} → {fmt(r.currentDate)} · {r.spanDays}일 간격
        </span>
      </div>

      {/* 핵심 두 지표 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#f2f0eb] rounded-[12px] p-4 space-y-1">
          <p className="text-xs text-black/[0.55] font-medium">AI 추천 점유율 (SOV)</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-extrabold text-black/87">{r.sov.current}%</span>
            <span className="text-sm text-black/40">이전 {r.sov.previous}%</span>
          </div>
          <DeltaPill delta={r.sov.delta} unit="%p" />
        </div>

        <div className="bg-[#f2f0eb] rounded-[12px] p-4 space-y-1">
          <p className="text-xs text-black/[0.55] font-medium">평균 추천 순위</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-extrabold text-black/87">
              {r.position.current !== null ? `${r.position.current}위` : '미노출'}
            </span>
            <span className="text-sm text-black/40">
              이전 {r.position.previous !== null ? `${r.position.previous}위` : '미노출'}
            </span>
          </div>
          <DeltaPill delta={r.position.delta} unit="계단" />
        </div>
      </div>

      {/* 경쟁사 판도 */}
      {hasCompetitorMoves && (
        <div className="space-y-2 border-t border-black/[0.08] pt-4">
          <p className="text-sm font-semibold text-black/75">경쟁사 판도</p>
          {r.risingCompetitors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-[#c82014] font-semibold">치고 올라온 곳 — 이 병원들이 우리 자리를 가져갔다</p>
              {r.risingCompetitors.map(c => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-black/87">{c.name}</span>
                  <span className="text-black/[0.55]">
                    {c.previousRate}% → <span className="font-bold text-[#c82014]">{c.currentRate}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {r.fallingCompetitors.length > 0 && (
            <div className="space-y-1 pt-2">
              <p className="text-xs text-[#006241] font-semibold">밀려난 곳</p>
              {r.fallingCompetitors.map(c => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-black/87">{c.name}</span>
                  <span className="text-black/[0.55]">
                    {c.previousRate}% → <span className="font-bold text-[#006241]">{c.currentRate}%</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 인용 출처 변동 */}
      {hasCitationMoves && (
        <div className="space-y-2 border-t border-black/[0.08] pt-4">
          <p className="text-sm font-semibold text-black/75">AI가 보는 출처 변동</p>
          {r.newCitations.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-black/[0.55]">새로 참고하기 시작한 곳</p>
              <Chips items={r.newCitations} tone="neutral" />
            </div>
          )}
          {r.lostCitations.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-xs text-black/[0.55]">더 이상 안 보는 곳</p>
              <Chips items={r.lostCitations} tone="neutral" />
            </div>
          )}
        </div>
      )}

      {/* 취약 키워드 변동 */}
      {hasKeywordMoves && (
        <div className="space-y-2 border-t border-black/[0.08] pt-4">
          <p className="text-sm font-semibold text-black/75">공략 키워드 변화</p>
          {r.fixedKeywords.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-[#006241] font-semibold">해결됨 — 이제 노출된다</p>
              <Chips items={r.fixedKeywords} tone="good" />
            </div>
          )}
          {r.newWeakKeywords.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-xs text-[#c82014] font-semibold">새로 밀린 키워드</p>
              <Chips items={r.newWeakKeywords} tone="bad" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
