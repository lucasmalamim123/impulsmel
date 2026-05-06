export const dynamic = 'force-dynamic';

import { api } from '../../../lib/api';
import { createAdminClient } from '../../../lib/supabase/admin-client';

interface Props {
  params: { tenantSlug: string };
  searchParams: Record<string, string | undefined>;
}

interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  user_role?: string | null;
  module?: string | null;
  status?: string | null;
  integration?: string | null;
  phone_normalized?: string | null;
  request_ip?: string | null;
  related_entity_id?: string | null;
  channel?: string | null;
  before_state?: unknown;
  after_state?: unknown;
  created_at: string;
}

const TYPES = ['', 'appointment', 'payment', 'customer', 'conversation'];

function queryWith(current: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...patch })) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export default async function AuditoriaPage({ params, searchParams }: Props) {
  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', params.tenantSlug).single();
  if (!tenant) return <div className="text-sm text-red-600">Tenant não encontrado.</div>;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) if (value) qs.set(key, value);

  const { logs, total, page, pageSize } = await api
    .get<{ logs: AuditLog[]; total: number; page: number; pageSize: number }>(`/api/tenants/${tenant.id}/audit?${qs.toString()}`)
    .catch(() => ({ logs: [], total: 0, page: Number(searchParams.page ?? 1), pageSize: 50 }));

  const totalPages = Math.ceil((total ?? 0) / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Auditoria</h1>
        <div className="flex gap-2">
          {TYPES.map(type => (
            <a key={type || 'all'} href={`/${params.tenantSlug}/auditoria${queryWith(searchParams, { type, page: undefined })}`} className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              (searchParams.type ?? '') === type ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 hover:bg-gray-50'
            }`}>
              {type || 'Todos'}
            </a>
          ))}
        </div>
      </div>

      <form className="bg-white rounded-xl shadow-sm p-4 grid gap-3 md:grid-cols-4">
        <input type="hidden" name="type" value={searchParams.type ?? ''} />
        <input name="from" defaultValue={searchParams.from ?? ''} placeholder="Data inicial ISO" className="border rounded-lg px-3 py-2 text-sm" />
        <input name="to" defaultValue={searchParams.to ?? ''} placeholder="Data final ISO" className="border rounded-lg px-3 py-2 text-sm" />
        <input name="user" defaultValue={searchParams.user ?? ''} placeholder="Usuário/ator" className="border rounded-lg px-3 py-2 text-sm" />
        <input name="module" defaultValue={searchParams.module ?? ''} placeholder="Módulo" className="border rounded-lg px-3 py-2 text-sm" />
        <input name="channel" defaultValue={searchParams.channel ?? ''} placeholder="Canal" className="border rounded-lg px-3 py-2 text-sm" />
        <input name="phone" defaultValue={searchParams.phone ?? ''} placeholder="Telefone" className="border rounded-lg px-3 py-2 text-sm" />
        <input name="integration" defaultValue={searchParams.integration ?? ''} placeholder="Integração" className="border rounded-lg px-3 py-2 text-sm" />
        <select name="status" defaultValue={searchParams.status ?? ''} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Status</option>
          <option value="success">Sucesso</option>
          <option value="failed">Falha</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" name="critical" value="true" defaultChecked={searchParams.critical === 'true'} />
          Ações críticas
        </label>
        <button className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">Filtrar</button>
      </form>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Entidade</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Ação</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Usuário</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Contexto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map(log => (
              <tr key={log.id} className="align-top hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{log.entity_type}</span>
                  <p className="text-[11px] text-gray-400 mt-1 font-mono">{log.entity_id}</p>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  <p>{log.action}</p>
                  <p className="text-xs text-gray-400">{log.status ?? 'success'}</p>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  <p>{log.actor}</p>
                  <p className="text-xs">{log.user_role ?? '-'}</p>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  <p>{log.module ?? '-'} · {log.channel ?? '-'}</p>
                  <p>{log.integration ?? '-'} · {log.phone_normalized ?? '-'}</p>
                  <p>{log.request_ip ?? ''}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-gray-600">before / after</summary>
                    <pre className="mt-2 bg-gray-50 rounded p-2 overflow-auto max-h-52">{JSON.stringify({ before: log.before_state, after: log.after_state, related: log.related_entity_id }, null, 2)}</pre>
                  </details>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">Nenhum registro encontrado.</div>}
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <a key={p} href={`/${params.tenantSlug}/auditoria${queryWith(searchParams, { page: String(p) })}`} className={`w-8 h-8 flex items-center justify-center rounded text-sm ${p === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
