'use client';

import { useState, useTransition } from 'react';

export interface IntegrationTestResult {
  ok: boolean;
  message?: string;
  error?: string;
  result?: unknown;
}

export function IntegrationTestButton({
  action,
}: {
  action: () => Promise<IntegrationTestResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<IntegrationTestResult | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            setResult(await action());
          });
        }}
        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white font-semibold text-gray-700 hover:border-[#d91e2e] hover:text-[#d91e2e] disabled:opacity-50"
      >
        {pending ? 'Testando...' : 'Testar integração'}
      </button>

      {result && (
        <div className={`rounded-lg border p-3 text-xs ${
          result.ok
            ? 'border-green-100 bg-green-50 text-green-700'
            : 'border-red-100 bg-red-50 text-red-700'
        }`}>
          <p className="font-semibold">{result.ok ? 'Funcionando' : 'Falhou'}</p>
          <p className="mt-1 break-words">{result.ok ? result.message ?? 'Integração validada.' : result.error ?? 'Erro ao testar integração.'}</p>
        </div>
      )}
    </div>
  );
}
