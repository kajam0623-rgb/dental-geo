'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Lock } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('비밀번호가 올바르지 않습니다.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#006400]/25 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-black/50 blur-[150px] pointer-events-none" />

      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-sm space-y-6 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-gradient-to-tr from-[#006400] to-black p-3 rounded-2xl shadow-lg shadow-[#006400]/30">
            <Activity className="text-white w-7 h-7" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">닥터원츠 GEO</h1>
            <p className="text-sm text-slate-400 mt-1">접근하려면 비밀번호를 입력하세요</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-300">비밀번호</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              autoFocus
              className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-700 bg-slate-800/50 text-white focus:outline-none focus:ring-2 focus:ring-[#006400] transition placeholder:text-slate-500"
            />
          </div>
          {error && <p className="text-rose-400 text-sm">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-[#006400] to-black text-white hover:shadow-[0_0_20px_rgba(0,100,0,0.5)] hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? '확인 중...' : '입장'}
        </button>
      </form>
    </div>
  );
}
