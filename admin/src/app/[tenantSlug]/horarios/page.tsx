export const dynamic = 'force-dynamic';

import { createAdminClient } from '../../../lib/supabase/admin-client';
import { saveHorarios } from './actions';

interface Props { params: { tenantSlug: string } }

const DAY_LABELS: Record<string, string> = {
  sun: 'Domingo', mon: 'Segunda', tue: 'Terça', wed: 'Quarta',
  thu: 'Quinta', fri: 'Sexta', sat: 'Sábado',
};

type TimeBlock = { open: string; close: string };

function normalizeBusinessHours(raw: string | undefined): Record<string, TimeBlock[] | null> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, TimeBlock | TimeBlock[] | null>;
    return Object.fromEntries(
      Object.entries(parsed).map(([day, value]) => [day, Array.isArray(value) ? value : value ? [value] : null]),
    );
  } catch {
    return {};
  }
}

function normalizeReminders(raw: string | undefined): number[] {
  if (!raw) return [24, 2, 0.5];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(Number).filter(n => Number.isFinite(n));
  } catch {
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) return [value];
  }
  return [24, 2, 0.5];
}

export default async function HorariosPage({ params }: Props) {
  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', params.tenantSlug).single();

  const { data: rows } = tenant
    ? await supabase.from('tenant_config').select('key, value').eq('tenant_id', tenant.id)
    : { data: [] };

  const cfg: Record<string, string> = {};
  for (const row of rows ?? []) cfg[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);

  const bh = normalizeBusinessHours(cfg['schedule.business_hours']);
  const reminders = normalizeReminders(cfg['schedule.reminder_hours']);
  const save = saveHorarios.bind(null, params.tenantSlug);

  return (
    <div className="w-full space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Horários de Funcionamento</h1>

      <form action={save} className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Dias e blocos de horário</h2>
          {Object.entries(DAY_LABELS).map(([day, label]) => {
            const blocks = bh[day] ?? null;
            const defaults = blocks?.length ? blocks : [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:00' }];
            return (
              <div key={day} className="rounded-lg border p-4 space-y-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name={`${day}_enabled`} defaultChecked={!!blocks} />
                  <span className="text-sm font-semibold">{label}</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 1, 2].map(index => (
                    <div key={index} className="flex items-center gap-2">
                      <input type="time" name={`${day}_${index}_open`} defaultValue={defaults[index]?.open ?? ''} className="border rounded px-2 py-1 text-sm w-28" />
                      <span className="text-gray-400 text-sm">até</span>
                      <input type="time" name={`${day}_${index}_close`} defaultValue={defaults[index]?.close ?? ''} className="border rounded px-2 py-1 text-sm w-28" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400">Preencha até 3 blocos. Deixe o bloco vazio para ignorar.</p>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Duração padrão (min)</span>
            <input type="number" name="default_duration" defaultValue={cfg['schedule.default_duration'] ?? '60'} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Intervalo entre slots (min)</span>
            <input type="number" name="slot_interval" defaultValue={cfg['schedule.slot_interval'] ?? '60'} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Horas mínimas para cancelar</span>
            <input type="number" name="cancel_policy_hours" defaultValue={cfg['schedule.cancel_policy_hours'] ?? '24'} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Lembretes (horas antes)</span>
            <input name="reminder_hours" defaultValue={reminders.join(', ')} placeholder="24, 2, 0.5" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </label>
        </div>

        <button type="submit" className="bg-blue-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          Salvar
        </button>
      </form>
    </div>
  );
}
