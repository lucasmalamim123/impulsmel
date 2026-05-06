'use client';

import { useState, useTransition } from 'react';
import { ConfirmAction } from '../../../components/ui/ConfirmAction';
import { Modal } from '../../../components/ui/Modal';
import { createProfissional, deleteProfissional, toggleProfissional, updateProfissional } from './actions';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayKey = typeof DAY_KEYS[number];
const DAY_LABELS: Record<DayKey, string> = {
  sun: 'Dom', mon: 'Seg', tue: 'Ter', wed: 'Qua', thu: 'Qui', fri: 'Sex', sat: 'Sab',
};

type TimeBlock = { open: string; close: string };
type BusinessHours = Record<DayKey, TimeBlock[] | null>;
type SchedulingMode = 'individual' | 'group';

interface Professional {
  id: string;
  name: string;
  aliases: string[];
  specialties: string[];
  gcal_calendar_id?: string;
  slot_capacity?: number;
  business_hours?: BusinessHours | Record<DayKey, TimeBlock | null> | null;
  active: boolean;
}

interface Service {
  id: string;
  name: string;
  scheduling_mode?: SchedulingMode;
}

interface ProfessionalService {
  professional_id: string;
  service_id: string;
  scheduling_mode: SchedulingMode;
  slot_capacity: number;
  active: boolean;
}

type ServiceRuleDraft = {
  service_id: string;
  scheduling_mode: SchedulingMode;
  slot_capacity: number;
  active: boolean;
};

interface Props {
  tenantSlug: string;
  professionals: Professional[];
  services: Service[];
  professionalServices: ProfessionalService[];
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(item => (
        <span key={item} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{item}</span>
      ))}
    </div>
  );
}

function emptySchedule(): BusinessHours {
  return { sun: null, mon: null, tue: null, wed: null, thu: null, fri: null, sat: null };
}

function scheduleFromDb(bh: Professional['business_hours']): BusinessHours {
  const normalized = Object.fromEntries(
    Object.entries(bh ?? {}).map(([day, value]) => [
      day,
      Array.isArray(value) ? value : value ? [value as TimeBlock] : null,
    ]),
  ) as Partial<BusinessHours>;
  return { ...emptySchedule(), ...normalized };
}

function buildInitialServiceRules(
  services: Service[],
  professionalServices: ProfessionalService[],
  professionalId: string,
): ServiceRuleDraft[] {
  return services.map(service => {
    const existing = professionalServices.find(rule => rule.professional_id === professionalId && rule.service_id === service.id);
    return {
      service_id: service.id,
      scheduling_mode: existing?.scheduling_mode ?? service.scheduling_mode ?? 'individual',
      slot_capacity: Math.max(1, Number(existing?.slot_capacity ?? 1)),
      active: existing?.active === true,
    };
  });
}

function ScheduleEditor({ value, onChange }: { value: BusinessHours; onChange: (v: BusinessHours) => void }) {
  const setBlocks = (day: DayKey, blocks: TimeBlock[] | null) => onChange({ ...value, [day]: blocks });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-700">Horarios de atendimento</p>
      <p className="text-xs text-gray-400">Dias sem marcacao usam o horario geral. Sem calendario proprio, usa a agenda geral do tenant.</p>
      {DAY_KEYS.map(day => {
        const blocks = value[day];
        const enabled = blocks !== null;
        return (
          <div key={day} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setBlocks(day, e.target.checked ? [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:00' }] : null)}
                />
                <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
              </label>
              {enabled && (
                <button type="button" onClick={() => setBlocks(day, [...(blocks ?? []), { open: '14:00', close: '18:00' }])} className="text-xs text-blue-600 hover:underline">
                  + bloco
                </button>
              )}
            </div>

            {enabled ? (
              <div className="space-y-2">
                {(blocks ?? []).map((block, index) => (
                  <div key={`${day}-${index}`} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={block.open}
                      onChange={e => {
                        const next = [...(blocks ?? [])];
                        next[index] = { ...block, open: e.target.value };
                        setBlocks(day, next);
                      }}
                      className="border rounded px-2 py-1 text-sm w-28"
                    />
                    <span className="text-gray-400 text-sm">ate</span>
                    <input
                      type="time"
                      value={block.close}
                      onChange={e => {
                        const next = [...(blocks ?? [])];
                        next[index] = { ...block, close: e.target.value };
                        setBlocks(day, next);
                      }}
                      className="border rounded px-2 py-1 text-sm w-28"
                    />
                    <button type="button" onClick={() => {
                      const next = (blocks ?? []).filter((_, i) => i !== index);
                      setBlocks(day, next.length ? next : null);
                    }} className="text-xs text-red-600 hover:underline">
                      remover
                    </button>
                  </div>
                ))}
              </div>
            ) : <span className="text-xs text-gray-300 italic">fechado</span>}
          </div>
        );
      })}
    </div>
  );
}

function ServiceRulesEditor({
  services,
  rules,
  onChange,
}: {
  services: Service[];
  rules: ServiceRuleDraft[];
  onChange: (rules: ServiceRuleDraft[]) => void;
}) {
  const updateRule = (serviceId: string, patch: Partial<ServiceRuleDraft>) => {
    onChange(rules.map(rule => rule.service_id === serviceId ? { ...rule, ...patch } : rule));
  };

  if (!services.length) return <p className="text-xs text-gray-400">Cadastre servicos para vincular modalidades.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-700">Servicos atendidos</p>
      {services.map(service => {
        const rule = rules.find(item => item.service_id === service.id)!;
        return (
          <div key={service.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_130px_120px]">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={rule.active}
                onChange={e => updateRule(service.id, { active: e.target.checked })}
              />
              {service.name}
            </label>
            <select
              value={rule.scheduling_mode}
              disabled={!rule.active}
              onChange={e => updateRule(service.id, { scheduling_mode: e.target.value === 'group' ? 'group' : 'individual' })}
              className="border rounded-lg px-2 py-1 text-sm disabled:bg-gray-50"
            >
              <option value="individual">Individual</option>
              <option value="group">Turma</option>
            </select>
            <input
              type="number"
              min={1}
              value={rule.slot_capacity}
              disabled={!rule.active || rule.scheduling_mode !== 'group'}
              onChange={e => updateRule(service.id, { slot_capacity: Math.max(1, Number(e.target.value) || 1) })}
              className="border rounded-lg px-2 py-1 text-sm disabled:bg-gray-50"
              aria-label={`Capacidade para ${service.name}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function AddForm({ tenantSlug }: { tenantSlug: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [schedule, setSchedule] = useState<BusinessHours>(emptySchedule());

  function submit(formData: FormData) {
    formData.set('business_hours', JSON.stringify(schedule));
    startTransition(async () => {
      await createProfissional(tenantSlug, formData);
      setOpen(false);
      setSchedule(emptySchedule());
    });
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">+ Adicionar profissional</button>;
  }

  return (
    <form action={submit} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">Novo profissional</h3>
      <input name="name" required placeholder="Nome" className="w-full border rounded-lg px-3 py-2 text-sm" />
      <input name="aliases" placeholder="Apelidos (virgula)" className="w-full border rounded-lg px-3 py-2 text-sm" />
      <input name="specialties" placeholder="Especialidades livres (virgula)" className="w-full border rounded-lg px-3 py-2 text-sm" />
      <label className="block text-xs font-medium text-gray-600">
        Capacidade geral fallback
        <input name="slot_capacity" type="number" min={1} defaultValue={1} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
      </label>
      <input name="gcal_calendar_id" placeholder="Google Calendar ID opcional" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
      <ScheduleEditor value={schedule} onChange={setSchedule} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {pending ? 'Salvando...' : 'Salvar'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50">Cancelar</button>
      </div>
    </form>
  );
}

function ProfRow({
  prof,
  tenantSlug,
  services,
  professionalServices,
}: {
  prof: Professional;
  tenantSlug: string;
  services: Service[];
  professionalServices: ProfessionalService[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(prof.name);
  const [aliases, setAliases] = useState(prof.aliases.join(', '));
  const [specialties, setSpecialties] = useState(prof.specialties.join(', '));
  const [gcal, setGcal] = useState(prof.gcal_calendar_id ?? '');
  const [slotCapacity, setSlotCapacity] = useState(Math.max(1, Number(prof.slot_capacity ?? 1)));
  const [schedule, setSchedule] = useState<BusinessHours>(scheduleFromDb(prof.business_hours));
  const [serviceRules, setServiceRules] = useState<ServiceRuleDraft[]>(
    buildInitialServiceRules(services, professionalServices, prof.id),
  );

  function saveEdit() {
    startTransition(async () => {
      await updateProfissional(tenantSlug, prof.id, {
        name,
        aliases: aliases.split(',').map(s => s.trim()).filter(Boolean),
        specialties: specialties.split(',').map(s => s.trim()).filter(Boolean),
        gcal_calendar_id: gcal || undefined,
        slot_capacity: slotCapacity,
        business_hours: schedule,
        serviceRules,
      });
      setEditing(false);
    });
  }

  const activeDays = DAY_KEYS.filter(d => schedule[d] !== null);
  const activeServiceRules = buildInitialServiceRules(services, professionalServices, prof.id)
    .filter(rule => rule.active)
    .map(rule => {
      const service = services.find(item => item.id === rule.service_id);
      return `${service?.name ?? 'Servico'} (${rule.scheduling_mode === 'group' ? `turma, ${rule.slot_capacity} vagas` : 'individual'})`;
    });

  if (editing) {
    return (
      <>
        <ProfessionalCard
          prof={prof}
          activeDays={activeDays}
          activeServiceRules={activeServiceRules}
          schedule={schedule}
          tenantSlug={tenantSlug}
          pending={pending}
          onEdit={() => setEditing(true)}
          onToggle={() => startTransition(() => toggleProfissional(tenantSlug, prof.id, !prof.active))}
        />
        <Modal
          open={editing}
          title={`Editar ${prof.name}`}
          description="Atualize dados do profissional, serviços atendidos, capacidade e horários."
          size="xl"
          onClose={() => setEditing(false)}
        >
          <div className="space-y-4">
            <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-medium" />
            <input value={aliases} onChange={e => setAliases(e.target.value)} placeholder="Apelidos" className="w-full border rounded-lg px-3 py-2 text-sm" />
            <input value={specialties} onChange={e => setSpecialties(e.target.value)} placeholder="Especialidades livres" className="w-full border rounded-lg px-3 py-2 text-sm" />
            <label className="block text-xs font-medium text-gray-600">
              Capacidade geral fallback
              <input value={slotCapacity} onChange={e => setSlotCapacity(Math.max(1, Number(e.target.value) || 1))} type="number" min={1} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
            <input value={gcal} onChange={e => setGcal(e.target.value)} placeholder="GCal ID" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
            <ServiceRulesEditor services={services} rules={serviceRules} onChange={setServiceRules} />
            <ScheduleEditor value={schedule} onChange={setSchedule} />
            <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4">
              <button type="button" onClick={() => setEditing(false)} className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50">Cancelar</button>
              <button type="button" onClick={saveEdit} disabled={pending} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">{pending ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <ProfessionalCard
      prof={prof}
      activeDays={activeDays}
      activeServiceRules={activeServiceRules}
      schedule={schedule}
      tenantSlug={tenantSlug}
      pending={pending}
      onEdit={() => setEditing(true)}
      onToggle={() => startTransition(() => toggleProfissional(tenantSlug, prof.id, !prof.active))}
    />
  );
}

function ProfessionalCard({
  prof,
  activeDays,
  activeServiceRules,
  schedule,
  tenantSlug,
  pending,
  onEdit,
  onToggle,
}: {
  prof: Professional;
  activeDays: DayKey[];
  activeServiceRules: string[];
  schedule: BusinessHours;
  tenantSlug: string;
  pending: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-5 ${!prof.active ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <p className="font-semibold text-gray-900">{prof.name}</p>
          <div><p className="text-xs text-gray-400 mb-1">Apelidos</p><ChipList items={prof.aliases} /></div>
          <div><p className="text-xs text-gray-400 mb-1">Especialidades livres</p><ChipList items={prof.specialties} /></div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Servicos atendidos</p>
            {activeServiceRules.length ? <ChipList items={activeServiceRules} /> : <p className="text-xs text-gray-300 italic">Nenhum servico vinculado</p>}
          </div>
          <p className="text-xs text-gray-500">Capacidade geral fallback: {Math.max(1, Number(prof.slot_capacity ?? 1))} por horario</p>
          <div className="text-xs text-gray-500 space-y-0.5">
            {activeDays.length > 0 ? (
              <>
                <p className="text-gray-400">Atende:</p>
                {activeDays.map(d => <p key={d}>{DAY_LABELS[d]}: {schedule[d]!.map(block => `${block.open}-${block.close}`).join(', ')}</p>)}
              </>
            ) : <p className="text-gray-300 italic">Horario geral do studio</p>}
          </div>
          <p className="text-xs text-gray-400">{prof.gcal_calendar_id ? 'Calendario proprio configurado' : 'Sem calendario proprio: usa agenda geral do tenant'}</p>
        </div>
        <div className="flex flex-col gap-2 items-end shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="text-xs px-3 py-1.5 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 transition-colors"
            >
              Editar
            </button>
            <ConfirmAction
              label="Excluir"
              title={`Excluir ${prof.name}?`}
              description="O cadastro sera removido da lista, mas o historico operacional sera preservado."
              confirmLabel="Excluir"
              disabled={pending}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 text-red-700 font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
              onConfirm={() => deleteProfissional(tenantSlug, prof.id)}
            />
          </div>
          <button onClick={onToggle} disabled={pending} className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors ${prof.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {prof.active ? 'Ativo' : 'Inativo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProfissionaisClient({ tenantSlug, professionals, services, professionalServices }: Props) {
  return (
    <div className="space-y-4">
      <AddForm tenantSlug={tenantSlug} />
      {professionals.map(p => (
        <ProfRow
          key={p.id}
          prof={p}
          tenantSlug={tenantSlug}
          services={services}
          professionalServices={professionalServices}
        />
      ))}
      {professionals.length === 0 && <p className="text-gray-500 text-sm">Nenhum profissional cadastrado.</p>}
    </div>
  );
}
