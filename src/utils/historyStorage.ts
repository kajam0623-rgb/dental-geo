import type { HistoryRecord } from '@/types/v3';

const KEY = 'dental-geo-history';

export function loadHistory(clinicFullName: string): HistoryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const all: HistoryRecord[] = raw ? JSON.parse(raw) : [];
    return all.filter(r => r.clinicFullName === clinicFullName).slice(-30);
  } catch {
    return [];
  }
}

export function saveHistory(record: HistoryRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(KEY);
    const all: HistoryRecord[] = raw ? JSON.parse(raw) : [];
    all.push(record);
    // keep last 200 records total
    localStorage.setItem(KEY, JSON.stringify(all.slice(-200)));
  } catch {
    // ignore storage errors
  }
}
