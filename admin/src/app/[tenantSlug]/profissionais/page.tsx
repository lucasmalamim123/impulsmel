export const dynamic = 'force-dynamic';

import { createAdminClient } from '../../../lib/supabase/admin-client';
import { ProfissionaisClient } from './ProfissionaisClient';

interface Props { params: { tenantSlug: string } }

export default async function ProfissionaisPage({ params }: Props) {
  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', params.tenantSlug)
    .single();

  const { data: professionals } = tenant
    ? await supabase
        .from('professionals')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .order('name')
    : { data: [] };

  const [{ data: services }, { data: professionalServices }] = tenant
    ? await Promise.all([
        supabase
          .from('services')
          .select('id, name, scheduling_mode, duration_minutes, active')
          .eq('tenant_id', tenant.id)
          .eq('active', true)
          .order('name'),
        supabase
          .from('professional_services')
          .select('professional_id, service_id, scheduling_mode, slot_capacity, active')
          .eq('tenant_id', tenant.id),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profissionais</h1>
      <ProfissionaisClient
        tenantSlug={params.tenantSlug}
        professionals={professionals ?? []}
        services={services ?? []}
        professionalServices={professionalServices ?? []}
      />
    </div>
  );
}
