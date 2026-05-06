'use server';

import { revalidatePath } from 'next/cache';
import { api } from '../../../lib/api';
import { createAdminClient } from '../../../lib/supabase/admin-client';

async function getTenantId(slug: string): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase.from('tenants').select('id').eq('slug', slug).single();
  if (!data) throw new Error('Tenant not found');
  return data.id;
}

export async function saveHorarios(slug: string, formData: FormData) {
  const tenantId = await getTenantId(slug);

  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const businessHours: Record<string, { open: string; close: string }[] | null> = {};

  for (const day of days) {
    const enabled = formData.get(`${day}_enabled`) === 'on';
    if (enabled) {
      const blocks = [0, 1, 2]
        .map(index => ({
          open: String(formData.get(`${day}_${index}_open`) ?? ''),
          close: String(formData.get(`${day}_${index}_close`) ?? ''),
        }))
        .filter(block => block.open && block.close);
      businessHours[day] = blocks.length ? blocks : null;
    } else {
      businessHours[day] = null;
    }
  }

  const reminders = String(formData.get('reminder_hours') ?? '')
    .split(',')
    .map(item => Number(item.trim()))
    .filter(value => Number.isFinite(value) && value > 0);

  await api.patch(`/api/tenants/${tenantId}/config`, {
    'schedule.business_hours': JSON.stringify(businessHours),
    'schedule.default_duration': formData.get('default_duration'),
    'schedule.slot_interval': formData.get('slot_interval'),
    'schedule.cancel_policy_hours': formData.get('cancel_policy_hours'),
    'schedule.reminder_hours': JSON.stringify(reminders.length ? reminders : [24, 2, 0.5]),
  });

  revalidatePath(`/${slug}/horarios`);
}
