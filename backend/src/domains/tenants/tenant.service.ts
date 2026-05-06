import { supabase } from '../../lib/supabase';
import { decryptSecret, encryptSecret, isEncryptedValue } from '../../lib/crypto';
import { Profissional, ProfessionalServiceInfo } from '../ai/ai.types';

export const TENANT_SECRET_KEYS = new Set([
  'asaas.api_key',
  'nexfit.api_key',
  'notion.token',
  'telegram.bot_token',
  'chatwoot.api_key',
  'whatsapp.api_key',
  'whatsapp.token',
  'megaapi.token',
  'evolution.api_key',
  'gcal.refresh_token',
]);

export function isTenantSecretKey(key: string): boolean {
  return TENANT_SECRET_KEYS.has(key);
}

export async function getDefaultTenantId(): Promise<string> {
  if (process.env.TENANT_ID) return process.env.TENANT_ID;

  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('active', true)
    .limit(1)
    .single();

  if (error || !data) throw new Error('No active tenant found. Set TENANT_ID env var.');
  return data.id;
}

export async function listActiveTenantIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('active', true);

  if (error) throw new Error(`Failed to list active tenants: ${error.message}`);
  return (data ?? []).map(row => row.id as string);
}

export async function loadProfissionais(tenantId: string): Promise<Profissional[]> {
  const [{ data }, { data: serviceLinks }] = await Promise.all([
    supabase
    .from('professionals')
    .select('id, name, aliases, specialties, gcal_calendar_id, slot_capacity, business_hours')
    .eq('tenant_id', tenantId)
      .eq('active', true),
    supabase
      .from('professional_services')
      .select(`
        id,
        professional_id,
        service_id,
        scheduling_mode,
        slot_capacity,
        active,
        services (
          id,
          name,
          price,
          duration_minutes,
          requires_handoff,
          active
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('active', true),
  ]);

  const linksByProfessional = new Map<string, ProfessionalServiceInfo[]>();
  for (const row of serviceLinks ?? []) {
    const service = Array.isArray(row.services) ? row.services[0] : row.services;
    if (!service || service.active === false) continue;
    const current = linksByProfessional.get(row.professional_id) ?? [];
    current.push({
      professionalServiceId: row.id,
      serviceId: row.service_id,
      id: service.id,
      nome: service.name,
      preco: Number(service.price ?? 0),
      duracaoMin: Number(service.duration_minutes ?? 60),
      requerHumano: Boolean(service.requires_handoff),
      schedulingMode: row.scheduling_mode === 'group' ? 'group' : 'individual',
      slotCapacity: Math.max(1, Number(row.slot_capacity ?? 1)),
      active: row.active !== false,
    });
    linksByProfessional.set(row.professional_id, current);
  }

  return (data ?? []).map(p => ({
    id: p.id,
    nome: p.name,
    apelidos: p.aliases as string[],
    especialidades: p.specialties as string[],
    gcalCalendarId: p.gcal_calendar_id ?? undefined,
    slotCapacity: Math.max(1, Number(p.slot_capacity ?? 1)),
    businessHours: normalizeBusinessHours(p.business_hours),
    servicos: linksByProfessional.get(p.id) ?? [],
  }));
}

export interface ServiceInfo {
  id?: string;
  nome: string;
  preco: number;
  duracaoMin: number;
  requerHumano: boolean;
  schedulingMode: 'individual' | 'group';
}

export async function loadServices(tenantId: string): Promise<ServiceInfo[]> {
  const { data } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes, requires_handoff, scheduling_mode')
    .eq('tenant_id', tenantId)
    .eq('active', true);

  return (data ?? []).map(s => ({
    id: s.id as string,
    nome: s.name as string,
    preco: Number(s.price ?? 0),
    duracaoMin: Number(s.duration_minutes ?? 60),
    requerHumano: Boolean(s.requires_handoff),
    schedulingMode: s.scheduling_mode === 'group' ? 'group' : 'individual',
  }));
}

export async function getServicePrice(tenantId: string, serviceName: string | null): Promise<number> {
  if (!serviceName) return 0;

  const { data } = await supabase
    .from('services')
    .select('price')
    .eq('tenant_id', tenantId)
    .ilike('name', `%${serviceName}%`)
    .eq('active', true)
    .limit(1)
    .single();

  return (data?.price as number) ?? 0;
}

export interface TenantPaymentConfig {
  enabled: boolean;          // bot pode acionar cobrança automática?
  environment: 'production' | 'sandbox';
}

export async function getTenantPaymentConfig(tenantId: string): Promise<TenantPaymentConfig> {
  const { data: rows } = await supabase
    .from('tenant_config')
    .select('key, value')
    .eq('tenant_id', tenantId)
    .in('key', ['payment.enabled', 'asaas.environment']);

  const cfg: Record<string, unknown> = {};
  for (const row of rows ?? []) cfg[row.key] = row.value;

  // Default: desabilitado (seguro — exige opt-in explícito)
  const enabled = cfg['payment.enabled'] === true || cfg['payment.enabled'] === 'true';
  const environment = cfg['asaas.environment'] === 'production' ? 'production' : 'sandbox';

  return { enabled, environment };
}

export async function getTenantConfigValue(
  tenantId: string,
  key: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from('tenant_config')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('key', key)
    .single();

  const value = data?.value;
  if (isTenantSecretKey(key)) return decryptSecret(value);
  return value as string | undefined;
}

export async function getTenantSecret(tenantId: string, key: string): Promise<string | undefined> {
  return getTenantConfigValue(tenantId, key);
}

export async function getTenantConfig(tenantId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('tenant_config')
    .select('key, value')
    .eq('tenant_id', tenantId);

  if (error) throw error;

  const config: Record<string, unknown> = {};
  for (const row of data ?? []) {
    config[row.key] = isTenantSecretKey(row.key)
      ? decryptSecret(row.value)
      : row.value;
  }
  return config;
}

export async function getSanitizedTenantConfig(tenantId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('tenant_config')
    .select('key, value')
    .eq('tenant_id', tenantId);

  if (error) throw error;

  const config: Record<string, unknown> = {};
  for (const row of data ?? []) {
    if (isTenantSecretKey(row.key)) {
      config[row.key] = {
        configured: Boolean(row.value),
        maskedValue: isEncryptedValue(row.value)
          ? row.value.maskedValue
          : typeof row.value === 'string'
            ? `••••••••${row.value.slice(-4)}`
            : undefined,
      };
    } else {
      config[row.key] = row.value;
    }
  }
  return config;
}

export async function setTenantConfig(
  tenantId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const upserts = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      tenant_id: tenantId,
      key,
      value: isTenantSecretKey(key) && typeof value === 'string'
        ? encryptSecret(value)
        : value,
      updated_at: new Date().toISOString(),
    }));

  if (!upserts.length) return;

  const { error } = await supabase
    .from('tenant_config')
    .upsert(upserts, { onConflict: 'tenant_id,key' });

  if (error) throw error;
}

export async function setTenantSecret(
  tenantId: string,
  key: string,
  value: string,
): Promise<void> {
  await setTenantConfig(tenantId, { [key]: value });
}

export async function findTenantIdByConfigValue(
  key: string,
  value: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('tenant_config')
    .select('tenant_id')
    .eq('key', key)
    .eq('value', value)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.tenant_id ?? null;
}

export async function getTenantFeatureFlag(tenantId: string, key: string): Promise<boolean> {
  const value = await getTenantConfigValue(tenantId, key);
  return value === 'true' || (value as unknown) === true;
}

export async function getTenantRagSyncIntervalHours(tenantId: string): Promise<number> {
  const { data: rows } = await supabase
    .from('tenant_config')
    .select('key, value')
    .eq('tenant_id', tenantId)
    .in('key', ['rag.sync_interval_hours', 'notion.sync_interval_hours']);

  const cfg: Record<string, unknown> = {};
  for (const row of rows ?? []) cfg[row.key] = row.value;

  const value = cfg['rag.sync_interval_hours'] ?? cfg['notion.sync_interval_hours'];
  const interval = typeof value === 'number' ? value : Number(value ?? 6);
  return Number.isFinite(interval) && interval > 0 ? interval : 6;
}


export interface TenantScheduleConfig {
  durationMinutes: number;
  slotIntervalMinutes: number;
  // day key: 'sun'|'mon'... -> [] or null = fechado
  businessHours: Record<string, { open: string; close: string }[] | null>;
  // calendário compartilhado do tenant (usado quando profissional não tem o próprio)
  sharedCalendarId: string;
}

function parseJsonbValue<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  return raw as T;
}

function normalizeBusinessHours(raw: unknown): Record<string, { open: string; close: string }[] | null> | undefined {
  const parsed = parseJsonbValue<Record<string, { open: string; close: string } | { open: string; close: string }[] | null>>(raw);
  if (!parsed) return undefined;
  return Object.fromEntries(
    Object.entries(parsed).map(([day, value]) => [
      day,
      Array.isArray(value) ? value : value ? [value] : null,
    ]),
  );
}

export async function getTenantScheduleConfig(tenantId: string): Promise<TenantScheduleConfig> {
  const { data: rows } = await supabase
    .from('tenant_config')
    .select('key, value')
    .eq('tenant_id', tenantId)
    .in('key', [
      'schedule.default_duration',
      'schedule.slot_interval',
      'schedule.business_hours',
      'gcal.calendar_id',
    ]);

  const cfg: Record<string, unknown> = {};
  for (const row of rows ?? []) cfg[row.key] = row.value;

  const businessHours = normalizeBusinessHours(cfg['schedule.business_hours']) ?? {};

  const sharedCalendarId = typeof cfg['gcal.calendar_id'] === 'string'
    ? (cfg['gcal.calendar_id'] as string)
    : '';

  console.log('[SCHEDULE_CONFIG]', {
    tenantId,
    sharedCalendarId,
    businessHoursKeys: Object.keys(businessHours),
    duration: cfg['schedule.default_duration'],
  });

  return {
    durationMinutes: Number(cfg['schedule.default_duration'] ?? 60),
    slotIntervalMinutes: Number(cfg['schedule.slot_interval'] ?? 60),
    businessHours,
    sharedCalendarId,
  };
}

export async function getTenantReminderHours(tenantId: string): Promise<number[]> {
  const value = await getTenantConfigValue(tenantId, 'schedule.reminder_hours');
  if (!value) return [24, 2, 0.5];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const hours = parsed.map(Number).filter(n => Number.isFinite(n) && n > 0);
      return hours.length ? hours : [24, 2, 0.5];
    }
  } catch {
    const single = Number(value);
    if (Number.isFinite(single) && single > 0) return [single];
  }
  return [24, 2, 0.5];
}
