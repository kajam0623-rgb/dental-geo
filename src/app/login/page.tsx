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
    <div className="min-h-screen bg-[#f2f0eb] flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 bg-white rounded-[12px] p-8"
        style={{ boxShadow: '0 0 0.5px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.10)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="bg-[#1E3932] p-3 rounded-xl">
            <Activity className="text-white w-7 h-7" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-[#1E3932]" style={{ letterSpacing: '-0.16px' }}>닥터원츠 GEO</h1>
            <p className="text-sm text-black/[0.55] mt-1">접근하려면 비밀번호를 입력하세요</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-black/87">비밀번호</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              autoFocus
              className="w-full pl-11 pr-4 py-3.5 rounded-[8px] border border-[#d6dbde] bg-white text-black/87 focus:outline-none focus:border-[#00754A] focus:ring-1 focus:ring-[#00754A] transition placeholder:text-black/30"
            />
          </div>
          {error && <p className="text-[#c82014] text-sm">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3.5 rounded-[50px] font-bold bg-[#00754A] text-white hover:shadow-[0_4px_16px_rgba(0,117,74,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? '확인 중...' : '입장'}
        </button>
      </form>
    </div>
  );
}
