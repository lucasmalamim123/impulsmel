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

export async function publishBotPrompt(slug: string, formData: FormData) {
  const tenantId = await getTenantId(slug);

  await api.post(`/api/tenants/${tenantId}/prompt/publish`, {
    fields: {
      botName: formData.get('bot_name'),
      studioName: formData.get('studio_name'),
      tone: formData.get('tone'),
      welcomeMessage: formData.get('welcome_message'),
      handoffMessage: formData.get('handoff_message'),
      extraRules: formData.get('extra_rules'),
      behaviorNotes: formData.get('behavior_notes'),
    },
  });
  revalidatePath(`/${slug}/bot`);
}

export async function rollbackBotPrompt(slug: string, version: number) {
  const tenantId = await getTenantId(slug);
  await api.post(`/api/tenants/${tenantId}/prompt/rollback`, { version });
  revalidatePath(`/${slug}/bot`);
}
