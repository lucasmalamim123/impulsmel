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

export async function createDocument(slug: string, formData: FormData) {
  const tenantId = await getTenantId(slug);
  await api.post(`/api/tenants/${tenantId}/knowledge-documents`, {
    title: formData.get('title'),
    category: formData.get('category'),
    content: formData.get('content'),
    status: formData.get('submit') === 'true' ? 'pending_approval' : 'draft',
  });
  revalidatePath(`/${slug}/conteudo`);
}

export async function updateDocument(slug: string, id: string, formData: FormData) {
  const tenantId = await getTenantId(slug);
  await api.patch(`/api/tenants/${tenantId}/knowledge-documents/${id}`, {
    title: formData.get('title'),
    category: formData.get('category'),
    content: formData.get('content'),
    status: formData.get('submit') === 'true' ? 'pending_approval' : undefined,
  });
  revalidatePath(`/${slug}/conteudo`);
}

export async function submitDocument(slug: string, id: string) {
  const tenantId = await getTenantId(slug);
  await api.post(`/api/tenants/${tenantId}/knowledge-documents/${id}/submit`);
  revalidatePath(`/${slug}/conteudo`);
}

export async function approveDocument(slug: string, id: string) {
  const tenantId = await getTenantId(slug);
  await api.post(`/api/tenants/${tenantId}/knowledge-documents/${id}/approve`);
  revalidatePath(`/${slug}/conteudo`);
}

export async function rejectDocument(slug: string, id: string) {
  const tenantId = await getTenantId(slug);
  await api.post(`/api/tenants/${tenantId}/knowledge-documents/${id}/reject`, { reason: 'Rejeitado pelo operador' });
  revalidatePath(`/${slug}/conteudo`);
}
