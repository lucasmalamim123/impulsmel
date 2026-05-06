import { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase';
import { getInstanceStatus, getQrCode } from '../../integrations/megaapi';
import { syncRagContentToVectors } from '../../domains/ai/rag.service';
import { runSimulatedChat } from '../../domains/ai/simulator.service';
import { ConversationState } from '../../domains/conversations/conversation.types';
import { getSanitizedTenantConfig, setTenantConfig } from '../../domains/tenants/tenant.service';
import { upsertIntegrationStatus } from '../../domains/operational/operational.service';

type PeriodKey = 'today' | 'yesterday' | 'this_month' | 'last_month' | 'custom';

function periodRange(query: { period?: string; from?: string; to?: string }): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  const period = (query.period ?? 'today') as PeriodKey;

  if (period === 'custom' && query.from && query.to) {
    return { from: query.from, to: query.to };
  }

  if (period === 'yesterday') {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'this_month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'last_month') {
    start.setMonth(start.getMonth() - 1, 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  return { from: start.toISOString(), to: end.toISOString() };
}

async function nextVersion(table: string, tenantId: string, extraFilter?: { column: string; value: string }): Promise<number> {
  let q = supabase.from(table).select('version').eq('tenant_id', tenantId).order('version', { ascending: false }).limit(1);
  if (extraFilter) q = q.eq(extraFilter.column, extraFilter.value);
  const { data } = await q.maybeSingle();
  return Number(data?.version ?? 0) + 1;
}

export async function adminApiRoutes(app: FastifyInstance): Promise<void> {
  // ─── Tenants ────────────────────────────────────────────────────────────────

  app.get('/api/tenants', async (_req, reply) => {
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, slug, plan, active, created_at')
      .order('created_at', { ascending: false });

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ tenants: data });
  });

  app.post('/api/tenants', async (req, reply) => {
    const body = req.body as { name: string; slug: string; plan?: string };
    const { data, error } = await supabase
      .from('tenants')
      .insert({ name: body.name, slug: body.slug, plan: body.plan ?? 'basic' })
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(201).send(data);
  });

  app.get('/api/admin/global-dashboard', async (req, reply) => {
    const query = req.query as { period?: string; from?: string; to?: string; instanceStatus?: string };
    const range = periodRange(query);

    const [
      tenantsRes,
      messageEventsRes,
      monthEventsRes,
      integrationRes,
      dlqPendingRes,
      incidentsRes,
      lastActivityRes,
      lastRagRes,
    ] = await Promise.all([
      supabase.from('tenants').select('id, name, slug, plan, active').order('name'),
      supabase.from('message_events').select('tenant_id, direction, message_type, created_at').gte('created_at', range.from).lte('created_at', range.to),
      supabase.from('message_events').select('tenant_id, direction, message_type, created_at').gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from('integration_status').select('*'),
      supabase.from('dead_letter_queue').select('tenant_id, integration, status').eq('status', 'pending'),
      supabase.from('incidents').select('tenant_id, type, description, resolved_at, created_at').is('resolved_at', null),
      supabase.from('message_events').select('tenant_id, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('rag_chunks').select('tenant_id, last_synced_at').order('last_synced_at', { ascending: false, nullsFirst: false }).limit(500),
    ]);

    if (tenantsRes.error) return reply.status(500).send({ error: tenantsRes.error.message });
    if (messageEventsRes.error) return reply.status(500).send({ error: messageEventsRes.error.message });

    const tenants = tenantsRes.data ?? [];
    const periodEvents = messageEventsRes.data ?? [];
    const monthEvents = monthEventsRes.data ?? [];
    const integrations = integrationRes.data ?? [];
    const dlqPending = dlqPendingRes.data ?? [];
    const incidents = incidentsRes.data ?? [];
    const lastActivity = new Map<string, string>();
    for (const row of lastActivityRes.data ?? []) {
      if (!lastActivity.has(row.tenant_id)) lastActivity.set(row.tenant_id, row.created_at);
    }
    const lastRag = new Map<string, string>();
    for (const row of lastRagRes.data ?? []) {
      if (!lastRag.has(row.tenant_id)) lastRag.set(row.tenant_id, row.last_synced_at);
    }

    const byTenant = new Map<string, { sent: number; received: number }>();
    const byType: Record<string, { sent: number; received: number }> = {};
    for (const event of periodEvents) {
      const bucket = byTenant.get(event.tenant_id) ?? { sent: 0, received: 0 };
      bucket[event.direction as 'sent' | 'received'] += 1;
      byTenant.set(event.tenant_id, bucket);
      byType[event.message_type] ??= { sent: 0, received: 0 };
      byType[event.message_type][event.direction as 'sent' | 'received'] += 1;
    }

    const monthTotals = monthEvents.reduce((acc, event) => {
      acc[event.direction as 'sent' | 'received'] += 1;
      return acc;
    }, { sent: 0, received: 0 });

    const integrationByTenant = new Map<string, typeof integrations>();
    for (const item of integrations) {
      const list = integrationByTenant.get(item.tenant_id) ?? [];
      list.push(item);
      integrationByTenant.set(item.tenant_id, list);
    }

    const rows = tenants.map(t => {
      const tenantIntegrations = integrationByTenant.get(t.id) ?? [];
      const whatsapp = tenantIntegrations.find(i => i.integration === 'whatsapp');
      const activeError = tenantIntegrations.find(i => i.status === 'error') ?? null;
      const volumes = byTenant.get(t.id) ?? { sent: 0, received: 0 };
      return {
        ...t,
        instanceStatus: whatsapp?.status ?? 'unknown',
        whatsappStatus: whatsapp?.status ?? 'unknown',
        lastConnectedAt: whatsapp?.last_connected_at ?? null,
        activeError: Boolean(activeError) || incidents.some(i => i.tenant_id === t.id),
        errorIntegration: activeError?.integration ?? incidents.find(i => i.tenant_id === t.id)?.type ?? null,
        lastError: activeError?.last_error ?? incidents.find(i => i.tenant_id === t.id)?.description ?? null,
        lastActivityAt: lastActivity.get(t.id) ?? null,
        periodSent: volumes.sent,
        periodReceived: volumes.received,
        dlqPending: dlqPending.filter(d => d.tenant_id === t.id).length,
        lastRagSyncAt: lastRag.get(t.id) ?? null,
      };
    }).filter(row => {
      if (!query.instanceStatus || query.instanceStatus === 'all') return true;
      if (query.instanceStatus === 'with_error') return row.activeError || row.instanceStatus === 'error';
      return row.instanceStatus === query.instanceStatus;
    });

    const totalSent = periodEvents.filter(e => e.direction === 'sent').length;
    const totalReceived = periodEvents.filter(e => e.direction === 'received').length;
    const connected = rows.filter(r => r.instanceStatus === 'connected').length;
    const disconnected = rows.filter(r => ['disconnected', 'unknown', 'pending'].includes(r.instanceStatus)).length;
    const errors = rows.filter(r => r.activeError || r.instanceStatus === 'error').length;

    return reply.send({
      range,
      summary: {
        totalTenants: tenants.length,
        webInstancesRunning: integrations.filter(i => i.integration === 'whatsapp').length,
        webInstancesConnected: connected,
        webInstancesDisconnected: disconnected,
        totalSent,
        totalReceived,
        monthSent: monthTotals.sent,
        monthReceived: monthTotals.received,
        tenantsWithActiveError: errors,
        integrationsWithError: integrations.filter(i => i.status === 'error').length,
        dlqPending: dlqPending.length,
      },
      messageTypes: byType,
      tenants: rows,
    });
  });

  app.get('/api/admin/global-alerts', async (_req, reply) => {
    const { data, error } = await supabase
      .from('integration_status')
      .select('*, tenants(name, slug)')
      .eq('status', 'error')
      .order('last_error_at', { ascending: false })
      .limit(50);

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ alerts: data ?? [] });
  });

  // ─── Tenant Config ───────────────────────────────────────────────────────────

  app.get('/api/tenants/:id/config', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const config = await getSanitizedTenantConfig(id);
      return reply.send({ config });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ error: message });
    }
  });

  app.patch('/api/tenants/:id/config', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    try {
      await setTenantConfig(id, body);
      return reply.send({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(400).send({ error: message });
    }
  });

  // ─── Professionals ───────────────────────────────────────────────────────────

  app.get('/api/tenants/:id/professionals', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('tenant_id', id)
      .order('name');

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ professionals: data });
  });

  app.post('/api/tenants/:id/professionals', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      name: string;
      aliases: string[];
      specialties: string[];
      gcal_calendar_id?: string;
      slot_capacity?: number;
      serviceRules?: Array<{
        service_id: string;
        scheduling_mode: 'individual' | 'group';
        slot_capacity: number;
        active: boolean;
      }>;
    };

    const { data, error } = await supabase
      .from('professionals')
      .insert({
        tenant_id: id,
        name: body.name,
        aliases: body.aliases,
        specialties: body.specialties,
        gcal_calendar_id: body.gcal_calendar_id,
        slot_capacity: body.slot_capacity,
      })
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    if (body.serviceRules?.length) {
      const { error: ruleError } = await supabase.from('professional_services').upsert(
        body.serviceRules.map(rule => ({
          tenant_id: id,
          professional_id: data.id,
          service_id: rule.service_id,
          scheduling_mode: rule.scheduling_mode === 'group' ? 'group' : 'individual',
          slot_capacity: Math.max(1, Number(rule.slot_capacity ?? 1)),
          active: rule.active !== false,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'professional_id,service_id' },
      );
      if (ruleError) return reply.status(400).send({ error: ruleError.message });
    }
    return reply.status(201).send(data);
  });

  app.patch('/api/tenants/:id/professionals/:pid', async (req, reply) => {
    const { pid } = req.params as { id: string; pid: string };
    const body = req.body as Partial<{
      name: string;
      aliases: string[];
      specialties: string[];
      gcal_calendar_id: string;
      slot_capacity: number;
      active: boolean;
      serviceRules: Array<{
        service_id: string;
        scheduling_mode: 'individual' | 'group';
        slot_capacity: number;
        active: boolean;
      }>;
    }>;
    const { serviceRules, ...professionalPatch } = body;

    const { data, error } = await supabase
      .from('professionals')
      .update(professionalPatch)
      .eq('id', pid)
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    if (serviceRules?.length) {
      const { id } = req.params as { id: string; pid: string };
      const { error: ruleError } = await supabase.from('professional_services').upsert(
        serviceRules.map(rule => ({
          tenant_id: id,
          professional_id: pid,
          service_id: rule.service_id,
          scheduling_mode: rule.scheduling_mode === 'group' ? 'group' : 'individual',
          slot_capacity: Math.max(1, Number(rule.slot_capacity ?? 1)),
          active: rule.active !== false,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'professional_id,service_id' },
      );
      if (ruleError) return reply.status(400).send({ error: ruleError.message });
    }
    return reply.send(data);
  });

  app.delete('/api/tenants/:id/professionals/:pid', async (req, reply) => {
    const { pid } = req.params as { id: string; pid: string };
    const { error } = await supabase.from('professionals').update({ active: false }).eq('id', pid);
    if (error) return reply.status(400).send({ error: error.message });
    return reply.send({ ok: true });
  });

  // ─── Services ────────────────────────────────────────────────────────────────

  app.get('/api/tenants/:id/services', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', id)
      .order('name');

    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ services: data });
  });

  app.post('/api/tenants/:id/services', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      name: string;
      price?: number;
      duration_minutes?: number;
      requires_handoff?: boolean;
      scheduling_mode?: 'individual' | 'group';
    };

    const { data, error } = await supabase
      .from('services')
      .insert({ tenant_id: id, ...body })
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(201).send(data);
  });

  app.patch('/api/tenants/:id/services/:sid', async (req, reply) => {
    const { sid } = req.params as { id: string; sid: string };
    const body = req.body as Partial<{
      name: string;
      price: number;
      duration_minutes: number;
      requires_handoff: boolean;
      scheduling_mode: 'individual' | 'group';
      active: boolean;
    }>;

    const { data, error } = await supabase
      .from('services')
      .update(body)
      .eq('id', sid)
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.send(data);
  });

  // ─── Metrics ─────────────────────────────────────────────────────────────────

  app.get('/api/tenants/:id/metrics', async (req, reply) => {
    const { id } = req.params as { id: string };
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [
      conversations,
      activeConversations,
      humanConversations,
      appointments,
      confirmedAppointments,
      cancelledAppointments,
      handoffs,
      dlqPending,
      professionals,
      lastRagSync,
      monthlyConversations,
      monthlyAppointments,
      monthlyHandoffs,
      monthlyDlq,
    ] = await Promise.all([
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .gte('created_at', today),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .in('status', ['bot', 'human']),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .eq('status', 'human'),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .gte('created_at', today),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .eq('status', 'confirmed')
        .gte('created_at', today),
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .eq('status', 'cancelled')
        .gte('created_at', today),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .eq('status', 'human')
        .gte('updated_at', today),
      supabase
        .from('dead_letter_queue')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .eq('status', 'pending'),
      supabase
        .from('professionals')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id)
        .eq('active', true),
      supabase
        .from('rag_chunks')
        .select('last_synced_at')
        .eq('tenant_id', id)
        .order('last_synced_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('conversations')
        .select('created_at')
        .eq('tenant_id', id)
        .gte('created_at', monthStart),
      supabase
        .from('appointments')
        .select('created_at, status')
        .eq('tenant_id', id)
        .gte('created_at', monthStart),
      supabase
        .from('conversations')
        .select('updated_at')
        .eq('tenant_id', id)
        .eq('status', 'human')
        .gte('updated_at', monthStart),
      supabase
        .from('dead_letter_queue')
        .select('created_at')
        .eq('tenant_id', id)
        .gte('created_at', monthStart),
    ]);

    const monthBuckets = new Map<string, { day: string; conversations: number; appointments: number; handoffs: number; dlq: number }>();
    const ensure = (iso: string) => {
      const day = iso.slice(0, 10);
      const current = monthBuckets.get(day) ?? { day, conversations: 0, appointments: 0, handoffs: 0, dlq: 0 };
      monthBuckets.set(day, current);
      return current;
    };
    for (const row of monthlyConversations.data ?? []) ensure(row.created_at).conversations += 1;
    for (const row of monthlyAppointments.data ?? []) ensure(row.created_at).appointments += 1;
    for (const row of monthlyHandoffs.data ?? []) ensure(row.updated_at).handoffs += 1;
    for (const row of monthlyDlq.data ?? []) ensure(row.created_at).dlq += 1;

    const resolutionRate = (conversations.count ?? 0) > 0
      ? Math.round((((conversations.count ?? 0) - (handoffs.count ?? 0)) / (conversations.count ?? 1)) * 100)
      : 0;
    const handoffRate = (conversations.count ?? 0) > 0
      ? Math.round(((handoffs.count ?? 0) / (conversations.count ?? 1)) * 100)
      : 0;

    return reply.send({
      conversations: conversations.count ?? 0,
      activeConversations: activeConversations.count ?? 0,
      realTimeAttendances: humanConversations.count ?? 0,
      appointments: appointments.count ?? 0,
      confirmedAppointments: confirmedAppointments.count ?? 0,
      cancelledAppointments: cancelledAppointments.count ?? 0,
      handoffs: handoffs.count ?? 0,
      botResolutionRate: resolutionRate,
      humanTransferRate: handoffRate,
      dlqPending: dlqPending.count ?? 0,
      professionalsCount: professionals.count ?? 0,
      lastRagSync: lastRagSync.data?.last_synced_at ?? null,
      monthlySeries: Array.from(monthBuckets.values()).sort((a, b) => a.day.localeCompare(b.day)),
    });
  });

  // ─── WhatsApp status & QR ────────────────────────────────────────────────────

  app.get('/api/tenants/:id/whatsapp/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const status = await getInstanceStatus(id);
      await upsertIntegrationStatus({
        tenantId: id,
        integration: 'whatsapp',
        status: status.connected ? 'connected' : 'disconnected',
        metadata: { user: status.user, host: status.host, instanceKey: status.instanceKey, rawStatus: status.status },
      });
      const qrcode = status.connected ? undefined : await getQrCode(id).catch(() => undefined);
      return reply.send({ ...status, qrcode });
    } catch (err) {
      await upsertIntegrationStatus({
        tenantId: id,
        integration: 'whatsapp',
        status: 'error',
        lastError: err instanceof Error ? err.message : String(err),
        autoRetry: true,
      });
      return reply.status(503).send({ connected: false, error: String(err) });
    }
  });

  app.post('/api/tenants/:id/whatsapp/reconnect', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const status = await getInstanceStatus(id);
      if (status.connected) {
        return reply.send({ ok: true, ...status, qrcode: undefined, message: 'Instância já conectada' });
      }
      const qrcode = await getQrCode(id);
      return reply.send({ ok: true, ...status, qrcode });
    } catch (err) {
      return reply.status(503).send({ ok: false, error: String(err) });
    }
  });

  app.get('/api/whatsapp/status', async (_req, reply) => {
    try {
      const status = await getInstanceStatus();
      const qrcode = status.connected ? undefined : await getQrCode().catch(() => undefined);
      return reply.send({ ...status, qrcode });
    } catch (err) {
      return reply.status(503).send({ connected: false, error: String(err) });
    }
  });

  // ─── Audit log ────────────────────────────────────────────────────────────────

  app.get('/api/tenants/:id/audit', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as {
      page?: string;
      type?: string;
      from?: string;
      to?: string;
      user?: string;
      module?: string;
      channel?: string;
      phone?: string;
      status?: string;
      integration?: string;
      entity?: string;
      critical?: string;
    };

    const page = Number(query.page ?? 1);
    const pageSize = 50;
    const from = (page - 1) * pageSize;

    let q = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (query.type || query.entity) q = q.eq('entity_type', query.type ?? query.entity);
    if (query.from) q = q.gte('created_at', query.from);
    if (query.to) q = q.lte('created_at', query.to);
    if (query.user) q = q.or(`actor.ilike.%${query.user}%,user_role.ilike.%${query.user}%`);
    if (query.module) q = q.eq('module', query.module);
    if (query.channel) q = q.eq('channel', query.channel);
    if (query.phone) q = q.ilike('phone_normalized', `%${query.phone}%`);
    if (query.status) q = q.eq('status', query.status);
    if (query.integration) q = q.eq('integration', query.integration);
    if (query.critical === 'true') q = q.in('action', ['cancelled', 'rescheduled', 'handoff']);

    const { data, count, error } = await q;
    if (error) return reply.status(500).send({ error: error.message });

    return reply.send({ logs: data, total: count, page, pageSize });
  });

  app.get('/api/tenants/:id/prompt', async (req, reply) => {
    const { id } = req.params as { id: string };
    const [config, versions] = await Promise.all([
      getSanitizedTenantConfig(id),
      supabase.from('prompt_versions').select('*').eq('tenant_id', id).order('version', { ascending: false }).limit(20),
    ]);
    if (versions.error) return reply.status(500).send({ error: versions.error.message });
    return reply.send({ config, versions: versions.data ?? [] });
  });

  app.post('/api/tenants/:id/prompt/publish', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { fields: Record<string, string>; authorId?: string };
    const fields = body.fields ?? {};
    const version = await nextVersion('prompt_versions', id);

    await setTenantConfig(id, {
      'bot.name': fields.botName ?? 'Sofia',
      'bot.studio_name': fields.studioName ?? '',
      'bot.tone': fields.tone ?? 'friendly',
      'bot.welcome_message': fields.welcomeMessage ?? '',
      'bot.handoff_message': fields.handoffMessage ?? '',
      'bot.extra_rules': fields.extraRules ?? '',
      'bot.behavior_notes': fields.behaviorNotes ?? '',
    });
    await supabase.from('prompt_versions').update({ status: 'archived' }).eq('tenant_id', id).eq('status', 'published');
    const { data, error } = await supabase.from('prompt_versions').insert({
      tenant_id: id,
      version,
      status: 'published',
      fields,
      author_id: body.authorId,
      published_at: new Date().toISOString(),
    }).select().single();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(201).send(data);
  });

  app.post('/api/tenants/:id/prompt/rollback', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { version: number };
    const { data: source, error } = await supabase
      .from('prompt_versions')
      .select('*')
      .eq('tenant_id', id)
      .eq('version', body.version)
      .single();
    if (error || !source) return reply.status(404).send({ error: 'Prompt version not found' });

    await supabase.from('prompt_versions').update({ status: 'archived' }).eq('tenant_id', id).eq('status', 'published');
    const version = await nextVersion('prompt_versions', id);
    const { data, error: insertError } = await supabase.from('prompt_versions').insert({
      tenant_id: id,
      version,
      status: 'published',
      fields: source.fields,
      published_at: new Date().toISOString(),
    }).select().single();
    if (insertError) return reply.status(400).send({ error: insertError.message });

    const fields = source.fields as Record<string, string>;
    await setTenantConfig(id, {
      'bot.name': fields.botName ?? 'Sofia',
      'bot.studio_name': fields.studioName ?? '',
      'bot.tone': fields.tone ?? 'friendly',
      'bot.welcome_message': fields.welcomeMessage ?? '',
      'bot.handoff_message': fields.handoffMessage ?? '',
      'bot.extra_rules': fields.extraRules ?? '',
      'bot.behavior_notes': fields.behaviorNotes ?? '',
    });

    return reply.send(data);
  });

  app.get('/api/tenants/:id/knowledge-documents', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { status?: string };
    let q = supabase.from('knowledge_documents').select('*').eq('tenant_id', id).order('updated_at', { ascending: false });
    if (query.status) q = q.eq('status', query.status);
    const { data, error } = await q;
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ documents: data ?? [] });
  });

  app.post('/api/tenants/:id/knowledge-documents', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { title: string; content: string; category?: string; status?: string; authorId?: string };
    const { data, error } = await supabase.from('knowledge_documents').insert({
      tenant_id: id,
      title: body.title,
      content: body.content ?? '',
      category: body.category ?? 'geral',
      status: body.status ?? 'draft',
      submitted_by: body.authorId,
    }).select().single();
    if (error) return reply.status(400).send({ error: error.message });
    await supabase.from('knowledge_document_versions').insert({
      document_id: data.id,
      tenant_id: id,
      version: 1,
      title: data.title,
      content: data.content,
      category: data.category,
      status: data.status,
      author_id: body.authorId,
    });
    return reply.status(201).send(data);
  });

  app.patch('/api/tenants/:id/knowledge-documents/:docId', async (req, reply) => {
    const { id, docId } = req.params as { id: string; docId: string };
    const body = req.body as Partial<{ title: string; content: string; category: string; status: string; authorId: string }>;
    const patch = {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('knowledge_documents').update(patch).eq('tenant_id', id).eq('id', docId).select().single();
    if (error) return reply.status(400).send({ error: error.message });
    const version = await nextVersion('knowledge_document_versions', id, { column: 'document_id', value: docId });
    await supabase.from('knowledge_document_versions').insert({
      document_id: data.id,
      tenant_id: id,
      version,
      title: data.title,
      content: data.content,
      category: data.category,
      status: data.status,
      author_id: body.authorId,
    });
    return reply.send(data);
  });

  async function rebuildPublishedKnowledge(tenantId: string): Promise<void> {
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('title, content, category')
      .eq('tenant_id', tenantId)
      .eq('status', 'published')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const content = (data ?? [])
      .map(doc => `# ${doc.title}\nCategoria: ${doc.category ?? 'geral'}\n\n${doc.content}`)
      .join('\n\n---\n\n');
    await setTenantConfig(tenantId, { 'rag.content': content });
    await syncRagContentToVectors(tenantId);
  }

  app.post('/api/tenants/:id/knowledge-documents/:docId/submit', async (req, reply) => {
    const { id, docId } = req.params as { id: string; docId: string };
    const { data, error } = await supabase.from('knowledge_documents')
      .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
      .eq('tenant_id', id).eq('id', docId).select().single();
    if (error) return reply.status(400).send({ error: error.message });
    return reply.send(data);
  });

  app.delete('/api/tenants/:id/services/:sid', async (req, reply) => {
    const { sid } = req.params as { id: string; sid: string };
    const { error } = await supabase.from('services').update({ active: false }).eq('id', sid);
    if (error) return reply.status(400).send({ error: error.message });
    return reply.send({ ok: true });
  });

  app.post('/api/tenants/:id/knowledge-documents/:docId/approve', async (req, reply) => {
    const { id, docId } = req.params as { id: string; docId: string };
    const { data, error } = await supabase.from('knowledge_documents')
      .update({
        status: 'published',
        approved_at: new Date().toISOString(),
        published_at: new Date().toISOString(),
        rejected_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', id).eq('id', docId).select().single();
    if (error) return reply.status(400).send({ error: error.message });
    await rebuildPublishedKnowledge(id);
    return reply.send(data);
  });

  app.post('/api/tenants/:id/knowledge-documents/:docId/reject', async (req, reply) => {
    const { id, docId } = req.params as { id: string; docId: string };
    const body = req.body as { reason?: string };
    const { data, error } = await supabase.from('knowledge_documents')
      .update({
        status: 'rejected',
        rejected_reason: body.reason ?? 'Rejeitado sem motivo informado',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', id).eq('id', docId).select().single();
    if (error) return reply.status(400).send({ error: error.message });
    return reply.send(data);
  });

  // ─── RAG sync ────────────────────────────────────────────────────────────────

  app.post('/api/tenants/:id/rag/sync', async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = await syncRagContentToVectors(id);
    return reply.send({ ok: true, ...result });
  });

  // ─── Simulator (testar bot) ──────────────────────────────────────────────────

  app.post('/api/tenants/:id/simulator/chat', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      message: string;
      sessionId?: string;
      state?: ConversationState;
      history?: { role: 'user' | 'assistant'; content: string }[];
    };

    if (!body?.message?.trim()) {
      return reply.status(400).send({ error: 'message é obrigatório' });
    }

    try {
      const result = await runSimulatedChat({
        tenantId: id,
        message: body.message,
        sessionId: body.sessionId,
        state: body.state,
        history: body.history,
      });
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SIMULATOR_ERROR]', message);
      return reply.status(500).send({ error: message });
    }
  });
}
