'use client';

import { useState, useTransition } from 'react';
import { ConfirmAction } from '../../../components/ui/ConfirmAction';
import { Modal } from '../../../components/ui/Modal';
import { deleteServico, updateServico } from './actions';

type SchedulingMode = 'individual' | 'group';

export interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  scheduling_mode?: SchedulingMode;
  requires_handoff: boolean;
  active: boolean;
}

function ServiceCard({ service, tenantSlug }: { service: Service; tenantSlug: string }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(service.name);
  const [price, setPrice] = useState(Number(service.price ?? 0));
  const [duration, setDuration] = useState(Number(service.duration_minutes ?? 60));
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>(service.scheduling_mode ?? 'individual');
  const [requiresHandoff, setRequiresHandoff] = useState(Boolean(service.requires_handoff));

  function save() {
    const formData = new FormData();
    formData.set('name', name);
    formData.set('price', String(price));
    formData.set('duration_minutes', String(duration));
    formData.set('scheduling_mode', schedulingMode);
    if (requiresHandoff) formData.set('requires_handoff', 'on');

    startTransition(async () => {
      await updateServico(tenantSlug, service.id, formData);
      setEditing(false);
    });
  }

  return (
    <section className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="font-semibold text-gray-900">{service.name}</p>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="brand-chip">R$ {Number(service.price ?? 0).toFixed(2)}</span>
            <span className="brand-chip">{service.duration_minutes ?? 60} min</span>
            <span className="brand-chip">{service.scheduling_mode === 'group' ? 'Turma' : 'Individual'}</span>
            {service.requires_handoff && <span className="brand-chip">Exige atendente</span>}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm px-4 py-2 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100"
          >
            Editar
          </button>
          <ConfirmAction
            label="Excluir"
            title={`Excluir ${service.name}?`}
            description="O servico sera removido da lista, mas o historico sera preservado."
            confirmLabel="Excluir"
            disabled={pending}
            className="text-sm px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
            onConfirm={() => deleteServico(tenantSlug, service.id)}
          />
        </div>
      </div>

      <Modal
        open={editing}
        title={`Editar ${service.name}`}
        description="Atualize a modalidade base. Regras por profissional ficam em Profissionais."
        size="lg"
        onClose={() => setEditing(false)}
      >
        <div className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm font-medium" />
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-xs font-medium text-gray-600">
              Preco
              <input value={price} onChange={e => setPrice(Number(e.target.value) || 0)} type="number" step="0.01" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Duracao
              <input value={duration} onChange={e => setDuration(Number(e.target.value) || 60)} type="number" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Tipo fallback
              <select value={schedulingMode} onChange={e => setSchedulingMode(e.target.value === 'group' ? 'group' : 'individual')} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                <option value="individual">Individual</option>
                <option value="group">Turma</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={requiresHandoff} onChange={e => setRequiresHandoff(e.target.checked)} />
            Agendamento exige atendente humano
          </label>

          <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4">
            <button type="button" onClick={() => setEditing(false)} className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50">Cancelar</button>
            <button type="button" onClick={save} disabled={pending} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50">
              {pending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

export function ServicosClient({ tenantSlug, services }: { tenantSlug: string; services: Service[] }) {
  return (
    <div className="space-y-3">
      {services.map(service => <ServiceCard key={service.id} service={service} tenantSlug={tenantSlug} />)}
      {services.length === 0 && <p className="text-gray-500 text-sm">Nenhum servico cadastrado.</p>}
    </div>
  );
}
