'use client';

import React, { useState } from 'react';
import { Building2, Clock, Trash2, Plus, ChevronRight, TrendingUp, ChevronLeft, RotateCcw, ListFilter } from 'lucide-react';
import type { ClinicRecord, SavedScan } from '@/types/v3';
import { deleteClinic, deleteScan } from '@/utils/clinicStorage';

function sovColor(sov: number) {
  return sov >= 60 ? 'text-[#39FF14]' : sov >= 30 ? 'text-amber-400' : 'text-rose-400';
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  clinics: ClinicRecord[];
  onNewAnalysis: () => void;
  onViewScan: (scan: SavedScan, clinic: ClinicRecord) => void;
  onRescan: (scan: SavedScan) => void;
  onNewPromptScan: (scan: SavedScan) => void;
  onRefresh: () => void;
}

export default function ClinicList({ clinics, onNewAnalysis, onViewScan, onRescan, onNewPromptScan, onRefresh }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const clinic = clinics.find(c => c.clinicFullName === selected);

  const handleDeleteClinic = async (name: string) => {
    if (!confirm(`"${name}" 치과의 모든 데이터를 삭제할까요?`)) return;
    await deleteClinic(name);
    setSelected(null);
    onRefresh();
  };

  const handleDeleteScan = async (clinicName: string, scanId: string) => {
    if (!confirm('이 스캔 결과를 삭제할까요?')) return;
    await deleteScan(clinicName, scanId);
    onRefresh();
  };

  // ── Clinic detail ──────────────────────────────────────────────
  if (selected && clinic) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate">{clinic.clinicFullName}</h2>
            <p className="text-sm text-slate-400">스캔 {clinic.scans.length}회 · {clinic.clinicShortName || clinic.clinicFullName}</p>
          </div>
        </div>

        {clinic.scans.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onRescan(clinic.scans[0])}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#006400] text-white text-sm font-bold hover:shadow-[0_0_16px_rgba(0,100,0,0.4)] transition"
            >
              <RotateCcw className="w-4 h-4" /> 같은 프롬프트로 재스캔
            </button>
            <button
              onClick={() => onNewPromptScan(clinic.scans[0])}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-slate-800 text-slate-300 text-sm font-semibold hover:text-white hover:bg-slate-700 transition"
            >
              <ListFilter className="w-4 h-4" /> 새 프롬프트 선택
            </button>
            <button
              onClick={() => handleDeleteClinic(clinic.clinicFullName)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 text-rose-400 text-sm font-semibold hover:bg-rose-500/10 transition ml-auto"
            >
              <Trash2 className="w-4 h-4" /> 치과 삭제
            </button>
          </div>
        )}

        <div className="space-y-3">
          {clinic.scans.map((scan, i) => (
            <div key={scan.id} className="bg-slate-800/60 border border-white/10 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                {i === 0 && (
                  <span className="text-xs bg-[#006400]/20 text-[#00a000] border border-[#006400]/30 px-2 py-0.5 rounded-full font-bold flex-shrink-0">최신</span>
                )}
                <span className="text-sm text-slate-300 font-medium flex-shrink-0">{fmtDate(scan.scanDate)}</span>
                <div className="flex items-center gap-3 text-xs text-slate-500 flex-shrink-0">
                  <span>GPT <span className={`font-bold ${sovColor(scan.summary.chatgpt.sov)}`}>{scan.summary.chatgpt.sov}%</span></span>
                  <span>GEM <span className={`font-bold ${sovColor(scan.summary.gemini.sov)}`}>{scan.summary.gemini.sov}%</span></span>
                  <span>종합 <span className={`font-bold ${sovColor(scan.summary.overall.sov)}`}>{scan.summary.overall.sov}%</span></span>
                </div>
                <span className="text-xs text-slate-600 flex-shrink-0">{scan.promptResults.length}개 프롬프트</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => onViewScan(scan, clinic)}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-semibold transition flex items-center gap-1"
                >
                  보기 <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteScan(clinic.clinicFullName, scan.id)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Clinic list ────────────────────────────────────────────────
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">저장된 치과</h2>
          <p className="text-sm text-slate-400 mt-1">{clinics.length}개 치과 · 데이터 보관 중</p>
        </div>
        <button
          onClick={onNewAnalysis}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#006400] text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(0,100,0,0.5)] hover:scale-[1.01] active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" /> 새 분석 시작
        </button>
      </div>

      {clinics.length === 0 ? (
        <div className="text-center py-24 space-y-4">
          <Building2 className="w-12 h-12 text-slate-700 mx-auto" />
          <p className="text-slate-500">아직 저장된 치과가 없습니다.</p>
          <button onClick={onNewAnalysis} className="text-[#00a000] text-sm hover:underline">새 분석 시작하기 →</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clinics.map(c => {
            const latest = c.scans[0];
            const sov = latest?.summary.overall.sov ?? 0;
            return (
              <button
                key={c.clinicFullName}
                onClick={() => setSelected(c.clinicFullName)}
                className="bg-slate-800/60 border border-white/10 hover:border-[#006400]/60 rounded-2xl p-5 text-left transition-all hover:bg-slate-800/90 group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold truncate">{c.clinicFullName}</p>
                    {c.clinicShortName && <p className="text-xs text-slate-500 truncate mt-0.5">{c.clinicShortName}</p>}
                  </div>
                  <span className={`text-2xl font-extrabold flex-shrink-0 ${sovColor(sov)}`}>{sov}%</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-3">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(c.lastUpdated)}</span>
                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" />{c.scans.length}회 스캔</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-[#00a000] mt-3 transition" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
