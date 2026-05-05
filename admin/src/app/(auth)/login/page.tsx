'use client';

import { useState } from 'react';
import { ImpulsmelMark } from '../../../components/brand/ImpulsmelMark';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
    const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin',
      });

      if (!res.ok) {
        setError('E-mail ou senha incorretos.');
        setLoading(false);
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1f252b] px-4">
      <div className="w-full max-w-sm space-y-7">
        <div className="text-center">
          <ImpulsmelMark inverted />
          <p className="mt-4 text-sm text-white/50">Painel de Administração</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 bg-white/[0.06] p-7 space-y-4 shadow-2xl shadow-black/20">
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">E-mail</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#d91e2e] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5">Senha</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-2 focus:ring-[#d91e2e] focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-[#d91e2e]/12 border border-[#d91e2e]/30 rounded-lg px-3 py-2">
              <p className="text-sm text-white">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="brand-button w-full mt-1">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
