export const dynamic = 'force-dynamic';

import { revalidatePath } from 'next/cache';
import { api } from '../../../lib/api';
import { createAdminClient } from '../../../lib/supabase/admin-client';
import { PaymentToggle } from './PaymentToggle';

interface Props { params: { tenantSlug: string } }

interface WaStatus {
  connected: boolean;
  status?: string;
  qrcode?: string;
  host?: string;
  instanceKey?: string;
  user?: { id?: string; name?: string };
  message?: string;
}
interface ConfigSecret { configured?: boolean; maskedValue?: string }
type ConfigValue = string | number | boolean | ConfigSecret | undefined;
type Config = Record<string, ConfigValue>;

const SECRET_FIELDS = new Set([
  'asaas.api_key',
  'nexfit.api_key',
  'notion.token',
  'telegram.bot_token',
  'chatwoot.api_key',
  'whatsapp.token',
  'gcal.refresh_token',
]);

async function reconnect(tenantId: string, slug: string) {
  'use server';
  await api.post(`/api/tenants/${tenantId}/whatsapp/reconnect`);
  revalidatePath(`/${slug}/integracoes`);
}

async function setPaymentEnabled(tenantId: string, slug: string, formData: FormData) {
  'use server';
  await api.patch(`/api/tenants/${tenantId}/config`, {
    'payment.enabled': formData.get('enabled') === 'on',
  });
  revalidatePath(`/${slug}/integracoes`);
}

async function saveConfig(tenantId: string, slug: string, formData: FormData) {
  'use server';
  const payload: Record<string, string | boolean | number> = {};

  for (const [rawKey, rawValue] of Array.from(formData.entries())) {
    const key = String(rawKey);
    if (key.startsWith('$')) continue;

    if (rawValue instanceof File) continue;
    const value = String(rawValue).trim();

    if (SECRET_FIELDS.has(key) && !value) continue;
    if (key.startsWith('feature.') || key.endsWith('_enabled') || key.endsWith('.enabled')) {
      payload[key] = value === 'on' || value === 'true';
    } else if (key.endsWith('_minutes') || key.endsWith('_hours') || key.endsWith('.account_id') || key.endsWith('.inbox_id')) {
      payload[key] = Number(value);
    } else if (value) {
      payload[key] = value;
    }
  }

  for (const key of String(formData.get('$checkboxes') ?? '').split(',').filter(Boolean)) {
    if (!formData.has(key)) payload[key] = false;
  }

  await api.patch(`/api/tenants/${tenantId}/config`, payload);
  revalidatePath(`/${slug}/integracoes`);
}

function secretPlaceholder(value: ConfigValue): string {
  if (typeof value === 'object' && value?.configured) return `${value.maskedValue ?? '••••••••'} configurado`;
  return '';
}

function textValue(value: ConfigValue): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function boolValue(value: ConfigValue): boolean {
  return value === true || value === 'true';
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {ok ? 'Configurado' : 'Pendente'}
    </span>
  );
}

function IntegrationCard({
  title,
  ok,
  className = '',
  children,
}: {
  title: string;
  ok: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`bg-white rounded-xl shadow-sm p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <StatusBadge ok={ok} />
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  cfg,
  type = 'text',
  placeholder,
}: {
  label: string;
  name: string;
  cfg: Config;
  type?: string;
  placeholder?: string;
}) {
  const isSecret = SECRET_FIELDS.has(name);
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      <input
        name={name}
        type={isSecret ? 'password' : type}
        defaultValue={isSecret ? '' : textValue(cfg[name])}
        placeholder={isSecret ? secretPlaceholder(cfg[name]) || placeholder : placeholder}
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );
}

function Toggle({ label, name, cfg }: { label: string; name: string; cfg: Config }) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700">
      <input name={name} type="checkbox" defaultChecked={boolValue(cfg[name])} className="rounded border-gray-300" />
      {label}
    </label>
  );
}

function SaveButton({ label = 'Salvar' }: { label?: string }) {
  return (
    <button type="submit" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
      {label}
    </button>
  );
}

export default async function IntegracoesPage({ params }: Props) {
  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', params.tenantSlug)
    .single();

  if (!tenant) {
    return <div className="text-sm text-red-600">Tenant não encontrado.</div>;
  }

  const { config: cfg } = await api.get<{ config: Config }>(`/api/tenants/${tenant.id}/config`);
  const waStatus = await api
    .get<WaStatus>(`/api/tenants/${tenant.id}/whatsapp/status`)
    .catch((): WaStatus => ({ connected: false }));

  const saveAction = saveConfig.bind(null, tenant.id, params.tenantSlug);
  const reconnectAction = reconnect.bind(null, tenant.id, params.tenantSlug);
  const togglePaymentAction = setPaymentEnabled.bind(null, tenant.id, params.tenantSlug);

  const hasSecret = (key: string) => typeof cfg[key] === 'object' && Boolean((cfg[key] as ConfigSecret).configured);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>

      <div className="grid gap-5 lg:grid-cols-3">
        <IntegrationCard title="WhatsApp (Mega API)" ok={waStatus.connected || Boolean(textValue(cfg['whatsapp.instance']))} className="order-1">
          <form action={saveAction} className="space-y-3">
            <Field label="URL da API" name="whatsapp.api_url" cfg={cfg} placeholder="https://api2.megaapi.com.br" />
            <Field label="Token" name="whatsapp.token" cfg={cfg} />
            <Field label="Instância" name="whatsapp.instance" cfg={cfg} />
            <SaveButton />
          </form>

          <div className="pt-3 border-t flex items-center justify-between">
            <div>
              <span className={`text-xs font-medium ${waStatus.connected ? 'text-green-700' : 'text-red-700'}`}>
                {waStatus.connected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
              </span>
              <p className="text-[11px] text-gray-400 mt-1">
                URL: {waStatus.host || textValue(cfg['whatsapp.api_url']) || 'não configurada'}
              </p>
              <p className="text-[11px] text-gray-400">
                Instância: {waStatus.instanceKey || textValue(cfg['whatsapp.instance']) || 'não configurada'}
                {waStatus.user?.name ? ` · ${waStatus.user.name}` : ''}
              </p>
            </div>
            {!waStatus.connected && (
              <form action={reconnectAction}>
                <button type="submit" className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-black">
                  Solicitar QR
                </button>
              </form>
            )}
          </div>

          {waStatus.qrcode && !waStatus.connected && (
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">Escaneie com o WhatsApp para reconectar</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={waStatus.qrcode} alt="QR Code WhatsApp" className="mx-auto w-48 h-48 rounded" />
            </div>
          )}
          {waStatus.connected && (
            <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-700">
              A Mega API informou que esta instância já está logada. O QR code só aparece quando a instância está desconectada.
            </div>
          )}
        </IntegrationCard>

        <IntegrationCard title="Google Calendar" ok={hasSecret('gcal.refresh_token') && Boolean(textValue(cfg['gcal.calendar_id']))} className="order-2">
          <form action={saveAction} className="space-y-3">
            <Field label="Conta Google" name="gcal.account" cfg={cfg} placeholder="agenda@studio.com" />
            <Field label="Refresh token" name="gcal.refresh_token" cfg={cfg} />
            <Field label="Calendar ID principal" name="gcal.calendar_id" cfg={cfg} placeholder="primary" />
            <input type="hidden" name="$checkboxes" value="gcal.bidirectional_sync" />
            <Toggle label="Sync bidirecional ativo" name="gcal.bidirectional_sync" cfg={cfg} />
            <SaveButton />
          </form>
        </IntegrationCard>

        <IntegrationCard title="Asaas" ok={hasSecret('asaas.api_key')} className="order-7">
          <form action={saveAction} className="space-y-3">
            <Field label="URL da API" name="asaas.api_url" cfg={cfg} placeholder="https://sandbox.asaas.com/api/v3" />
            <Field label="API key" name="asaas.api_key" cfg={cfg} />
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Ambiente</span>
              <select name="asaas.environment" defaultValue={textValue(cfg['asaas.environment']) || 'sandbox'} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="sandbox">Sandbox</option>
                <option value="production">Produção</option>
              </select>
            </label>
            <SaveButton />
          </form>
          <PaymentToggle enabled={boolValue(cfg['payment.enabled'])} action={togglePaymentAction} />
        </IntegrationCard>

        <IntegrationCard title="Nexfit" ok={hasSecret('nexfit.api_key')} className="order-5">
          <form action={saveAction} className="space-y-3">
            <Field label="URL da API" name="nexfit.api_url" cfg={cfg} />
            <Field label="API key" name="nexfit.api_key" cfg={cfg} />
            <input type="hidden" name="$checkboxes" value="nexfit.check_eligibility" />
            <Toggle label="Verificar elegibilidade antes de confirmar" name="nexfit.check_eligibility" cfg={cfg} />
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Ação se inelegível</span>
              <select name="nexfit.ineligible_action" defaultValue={textValue(cfg['nexfit.ineligible_action']) || 'block'} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="block">Bloquear</option>
                <option value="handoff">Transferir para humano</option>
              </select>
            </label>
            <SaveButton />
          </form>
        </IntegrationCard>

        <IntegrationCard title="Notion" ok={hasSecret('notion.token') && Boolean(textValue(cfg['notion.database_id']) || textValue(cfg['notion.leads_database_id']))} className="order-4">
          <form action={saveAction} className="space-y-3">
            <Field label="Token da integração" name="notion.token" cfg={cfg} />
            <Field label="Database ID do RAG" name="notion.database_id" cfg={cfg} />
            <Field label="Database ID de leads" name="notion.leads_database_id" cfg={cfg} />
            <Field label="Intervalo de sync (horas)" name="notion.sync_interval_hours" cfg={cfg} type="number" placeholder="6" />
            <input type="hidden" name="$checkboxes" value="notion.leads_enabled" />
            <Toggle label="Criar lead no Notion quando um contato novo entrar" name="notion.leads_enabled" cfg={cfg} />
            <SaveButton />
          </form>
        </IntegrationCard>

        <IntegrationCard title="Chatwoot" ok={hasSecret('chatwoot.api_key') && Boolean(textValue(cfg['chatwoot.account_id']) && textValue(cfg['chatwoot.inbox_id']))} className="order-3">
          <form action={saveAction} className="space-y-3">
            <Field label="URL" name="chatwoot.api_url" cfg={cfg} placeholder="https://chatwoot.seudominio.com" />
            <Field label="API key" name="chatwoot.api_key" cfg={cfg} />
            <Field label="Account ID" name="chatwoot.account_id" cfg={cfg} type="number" />
            <Field label="Inbox ID" name="chatwoot.inbox_id" cfg={cfg} type="number" />
            <SaveButton />
          </form>
        </IntegrationCard>

        <IntegrationCard title="Telegram" ok={hasSecret('telegram.bot_token') && Boolean(textValue(cfg['telegram.alert_chat_id']))} className="order-6">
          <form action={saveAction} className="space-y-3">
            <Field label="Bot token" name="telegram.bot_token" cfg={cfg} />
            <Field label="Chat ID de alertas" name="telegram.alert_chat_id" cfg={cfg} />
            <SaveButton />
          </form>
        </IntegrationCard>

        <IntegrationCard title="Canais" ok className="order-8">
          <form action={saveAction} className="space-y-3">
            <input type="hidden" name="$checkboxes" value="feature.instagram_enabled,feature.messenger_enabled,feature.tiktok_enabled" />
            <Field label="Instagram Account ID" name="instagram.account_id" cfg={cfg} />
            <Field label="Messenger Page ID" name="messenger.page_id" cfg={cfg} />
            <Toggle label="Instagram ativo" name="feature.instagram_enabled" cfg={cfg} />
            <Toggle label="Messenger ativo" name="feature.messenger_enabled" cfg={cfg} />
            <Toggle label="TikTok ativo" name="feature.tiktok_enabled" cfg={cfg} />
            <SaveButton label="Salvar canais" />
          </form>
        </IntegrationCard>
      </div>
    </div>
  );
}
