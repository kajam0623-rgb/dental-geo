// @vitest-environment node
// 실 @vercel/kv 클라이언트 + 실 HTTP 왕복으로 저장 라우트를 검증한다.
// vi.mock이 아니라 진짜 클라이언트를 태우므로 직렬화·Set 처리 같은 실제 동작이 드러난다.
// 사전 준비: node fake-upstash.mjs (Upstash REST 호환 로컬 서버, 포트 6399)
import { describe, it, expect, beforeAll } from 'vitest';
import type { V3AnalysisResult, ClinicRecord, ScanTexts } from '@/types/v3';

process.env.KV_REST_API_URL = 'http://127.0.0.1:6399';
process.env.KV_REST_API_TOKEN = 'local-fake-token';

const { GET, POST, DELETE } = await import('@/app/api/storage/clinics/route');

function makeResult(name: string, scanDate = '2026-08-11T00:00:00.000Z'): V3AnalysisResult {
  return {
    input: { clinicFullName: name, clinicShortName: '', treatments: ['임플란트'], regions: ['강남역'] },
    settings: { chatgptCount: 3, geminiCount: 3 },
    scanDate,
    schemaVersion: 2,
    promptResults: [{
      prompt: { id: 'p1', text: 'q', displayText: '강남역 임플란트', category: '지역형' },
      chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0, responseTexts: ['[오류] no credits', '[오류] no credits', '[오류] no credits'], positions: [null, null, null], oks: [false, false, false] },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 3, sov: 100, responseTexts: ['1. 하루플란트치과의원 2. 똑똑플란트치과의원', '1. 하루플란트치과의원', '2. 하루플란트치과의원'], positions: [1, 1, 2], oks: [true, true, true] },
    }],
    summary: {
      chatgpt: { total: 3, answered: 0, failed: 3, mentions: 0, sov: 0 },
      gemini: { total: 3, answered: 3, failed: 0, mentions: 3, sov: 100 },
      overall: { sov: 100 }, totalAnswered: 3, totalFailed: 3, bothVisibleRate: 0, avgPosition: 1.3,
    },
    competitorRankings: [{ name: '똑똑플란트치과의원', mentions: 1, exposureRate: 33.3, avgPosition: 2 }],
    weakKeywords: [],
  };
}

const post = (r: V3AnalysisResult) => POST(new Request('http://x/', { method: 'POST', body: JSON.stringify(r) }));
const list = () => GET(new Request('http://x/'));
const texts = (id: string) => GET(new Request(`http://x/?scanId=${id}`));
const del = (b: unknown) => DELETE(new Request('http://x/', { method: 'DELETE', body: JSON.stringify(b) }));

beforeAll(async () => {
  const res = await fetch('http://127.0.0.1:6399/', { method: 'POST', body: JSON.stringify(['SET', '__ping', '1']) });
  if (!res.ok) throw new Error('fake-upstash 서버가 안 떠 있다. node fake-upstash.mjs 실행할 것');
});

describe('실 KV 클라이언트 왕복', () => {
  it('저장 → 조회 → 원문 → 삭제가 실제 HTTP로 왕복한다', async () => {
    // 깨끗한 상태에서 시작
    await del({ clinicName: '왕복치과의원' });

    const saveRes = await post(makeResult('왕복치과의원'));
    expect(saveRes.status).toBe(200);
    const { scanId } = await saveRes.json();
    console.log('\n저장된 scanId:', scanId);

    const listed = await (await list()).json() as { clinics: ClinicRecord[] };
    const found = listed.clinics.find(c => c.clinicFullName === '왕복치과의원');
    console.log('조회된 치과:', found?.clinicFullName, '| 스캔', found?.scans.length, '건',
      '| schemaVersion', found?.schemaVersion);
    expect(found).toBeTruthy();
    expect(found!.scans[0].summary.gemini.sov).toBe(100);
    expect(found!.scans[0].summary.chatgpt.failed).toBe(3);
    expect(found!.scans[0].promptResults[0].gemini.positions).toEqual([1, 1, 2]);

    const { texts: t } = await (await texts(scanId)).json() as { texts: ScanTexts };
    console.log('복원된 원문 1건:', t.byPrompt[0].gemini[0]);
    expect(t.byPrompt[0].gemini).toHaveLength(3);
    expect(t.byPrompt[0].gemini[0]).toContain('하루플란트치과의원');
    expect(t.byPrompt[0].chatgptOks).toEqual([false, false, false]);

    await del({ clinicName: '왕복치과의원' });
    const after = await (await list()).json() as { clinics: ClinicRecord[] };
    expect(after.clinics.find(c => c.clinicFullName === '왕복치과의원')).toBeUndefined();
    const { texts: gone } = await (await texts(scanId)).json();
    expect(gone).toBeNull();
    console.log('삭제 후 치과·원문 모두 제거 확인');
  }, 60000);

  it('서로 다른 치과 동시 저장 — Redis Set 인덱스가 유실을 막는다', async () => {
    const names = ['동시가치과의원', '동시나치과의원', '동시다치과의원', '동시라치과의원'];
    await Promise.all(names.map(n => del({ clinicName: n })));

    await Promise.all(names.map(n => post(makeResult(n))));

    const { clinics } = await (await list()).json() as { clinics: ClinicRecord[] };
    const survived = names.filter(n => clinics.some(c => c.clinicFullName === n));
    console.log(`동시 저장 ${names.length}건 중 생존:`, survived.length, '—', survived.join(', '));
    expect(survived).toHaveLength(names.length);

    await Promise.all(names.map(n => del({ clinicName: n })));
  }, 60000);

  it('구 스키마가 있으면 자동 이관하고 옛 키를 지운다', async () => {
    const { kv } = await import('@vercel/kv');
    await kv.set('geo-clinics-v2', {
      '구버전치과의원': {
        clinicFullName: '구버전치과의원', clinicShortName: '구버전',
        lastUpdated: '2026-04-25T00:00:00.000Z',
        scans: [{ id: 'old-1', scanDate: '2026-04-25T00:00:00.000Z' }],
      },
    });

    const { clinics } = await (await list()).json() as { clinics: ClinicRecord[] };
    const migrated = clinics.find(c => c.clinicFullName === '구버전치과의원');
    console.log('이관 결과:', migrated?.clinicFullName, '| schemaVersion', migrated?.schemaVersion);
    expect(migrated).toBeTruthy();
    expect(migrated!.schemaVersion).toBe(2);
    expect(await kv.get('geo-clinics-v2')).toBeNull();

    await del({ clinicName: '구버전치과의원' });
  }, 60000);
});
