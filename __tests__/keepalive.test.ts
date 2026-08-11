// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';

const store = new Map<string, unknown>();
let failNext = false;
vi.mock('@vercel/kv', () => ({
  kv: {
    get: async (k: string) => {
      if (failNext) throw new Error('ENOTFOUND upstash.io');
      const v = store.get(k);
      return v === undefined ? null : structuredClone(v);
    },
    set: async (k: string, v: unknown) => {
      if (failNext) throw new Error('ENOTFOUND upstash.io');
      store.set(k, structuredClone(v));
    },
  },
}));

const { GET } = await import('@/app/api/keepalive/route');
const req = (auth?: string) =>
  new Request('http://x/api/keepalive', { headers: auth ? { authorization: auth } : {} });

beforeEach(() => { store.clear(); failNext = false; delete process.env.CRON_SECRET; });

describe('keepalive — KV 활성 유지', () => {
  it('KV에 실제로 읽고 쓴다 (Upstash가 활동으로 인식하는 지점)', async () => {
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.count).toBe(1);
    expect(store.has('geo:keepalive')).toBe(true);
    console.log('\n1회차:', JSON.stringify(body));
  });

  it('호출할 때마다 카운트가 올라간다', async () => {
    await GET(req());
    await GET(req());
    const body = await (await GET(req())).json();
    expect(body.count).toBe(3);
    expect(body.previousPingAt).toBeTruthy();
    console.log('3회차:', JSON.stringify(body));
  });

  it('CRON_SECRET이 설정되면 올바른 헤더만 통과시킨다', async () => {
    process.env.CRON_SECRET = 'super-secret';
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer wrong'))).status).toBe(401);
    expect((await GET(req('Bearer super-secret'))).status).toBe(200);
    console.log('인증: 헤더없음 401 · 틀린값 401 · 정상 200');
  });

  it('KV가 죽어 있으면 500으로 알려준다 (조기 감지)', async () => {
    failNext = true;
    const res = await GET(req());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toContain('KV 접근에 실패');
    console.log('KV 사망 시:', res.status, body.error);
  });
});

describe('vercel.json cron 설정', () => {
  it('Hobby 플랜 제약(최대 2개·하루 1회 이하)을 지킨다', async () => {
    const fs = await import('node:fs');
    const cfg = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    expect(cfg.crons).toHaveLength(1);
    expect(cfg.crons.length).toBeLessThanOrEqual(2);

    const { path, schedule } = cfg.crons[0];
    expect(path).toBe('/api/keepalive');

    // 5필드 · 숫자만 (MON/JAN 같은 이름값은 Vercel이 거부한다)
    const fields = schedule.trim().split(/\s+/);
    expect(fields).toHaveLength(5);
    expect(schedule).not.toMatch(/[A-Za-z]/);

    // 분·시가 고정값이어야 하루 1회다. */5 같은 게 있으면 Hobby에서 배포 거부된다
    expect(fields[0]).toMatch(/^\d+$/);
    expect(fields[1]).toMatch(/^\d+$/);
    console.log('cron:', schedule, `(UTC ${fields[1]}시 ${fields[0]}분 = KST ${(Number(fields[1]) + 9) % 24}시)`);
  });
});
