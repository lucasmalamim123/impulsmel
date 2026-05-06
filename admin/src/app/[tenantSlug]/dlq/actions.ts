'use server';

import { revalidatePath } from 'next/cache';
import { api } from '../../../lib/api';

export async function replayOne(slug: string, id: string) {
  await api.post(`/admin/dlq/${id}/replay`);
  revalidatePath(`/${slug}/dlq`);
}

export async function replayAll(slug: string, tenantId?: string) {
  await api.post('/admin/dlq/replay-all', { tenantId });
  revalidatePath(`/${slug}/dlq`);
}

export async function discardOne(slug: string, id: string) {
  await api.patch(`/admin/dlq/${id}/discard`);
  revalidatePath(`/${slug}/dlq`);
}

export async function simulateDlq(slug: string, tenantId?: string) {
  if (!tenantId) return;
  await api.post('/admin/dlq/simulate', { tenantId });
  revalidatePath(`/${slug}/dlq`);
}
