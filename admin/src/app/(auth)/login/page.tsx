'use client';

import { useState } from 'react';
import { ImpulsmelMark } from '../../../components/brand/ImpulsmelMark';
import { ThemeToggle } from '../../../components/theme/ThemeToggle';

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
    <main className="flex min-h-screen items-center justify-center bg-[var(--dashboard-bg)] px-4 text-[var(--dashboard-text)]">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-7">
        <div className="text-center">
          <ImpulsmelMark />
          <p className="mt-4 text-sm text-[var(--dashboard-text-muted)]">Painel de Administração</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-7 shadow-[var(--dashboard-shadow)]">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--dashboard-text-muted)]">E-mail</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              className="w-full rounded-lg border px-3 py-2.5 text-sm placeholder:text-[var(--dashboard-text-soft)] focus:outline-none focus:ring-2 focus:ring-[#d91e2e]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--dashboard-text-muted)]">Senha</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border px-3 py-2.5 text-sm placeholder:text-[var(--dashboard-text-soft)] focus:outline-none focus:ring-2 focus:ring-[#d91e2e]"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-[#d91e2e]/30 bg-[#d91e2e]/12 px-3 py-2">
              <p className="text-sm text-[var(--dashboard-text)]">{error}</p>
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
