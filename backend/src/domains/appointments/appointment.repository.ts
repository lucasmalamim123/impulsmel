import { supabase } from '../../lib/supabase';
import { Appointment, AppointmentStatus } from './appointment.types';

export async function createAppointment(data: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>): Promise<Appointment> {
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return appointment;
}

export async function findByIdempotencyKey(tenantId: string, key: string): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('idempotency_key', key)
    .single();

  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function updateStatus(id: string, status: AppointmentStatus, gcalEventId?: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status, gcal_event_id: gcalEventId, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

export async function findById(id: string, tenantId?: string): Promise<Appointment | null> {
  let query = supabase
    .from('appointments')
    .select('*')
    .eq('id', id);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data, error } = await query.single();

  if (error?.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

export async function findUpcomingByCustomer(tenantId: string, customerId: string): Promise<Appointment[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function acquireLock(id: string, durationMs: number): Promise<boolean> {
  const lockedUntil = new Date(Date.now() + durationMs).toISOString();
  const { error } = await supabase
    .from('appointments')
    .update({ locked_until: lockedUntil })
    .eq('id', id)
    .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`);

  return !error;
}

export async function countConfirmedForSlot(params: {
  tenantId: string;
  professionalId: string;
  serviceId?: string;
  serviceType: string;
  scheduledAt: string;
  excludeAppointmentId?: string;
}): Promise<number> {
  let query = supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', params.tenantId)
    .eq('professional_id', params.professionalId)
    .eq('scheduled_at', params.scheduledAt)
    .eq('status', 'confirmed');

  query = params.serviceId
    ? query.eq('service_id', params.serviceId)
    : query.eq('service_type', params.serviceType);

  if (params.excludeAppointmentId) query = query.neq('id', params.excludeAppointmentId);

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
