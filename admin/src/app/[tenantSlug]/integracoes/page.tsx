export const dynamic = 'force-dynamic';

import { revalidatePath } from 'next/cache';
import { api } from '../../../lib/api';
import { createAdminClient } from '../../../lib/supabase/admin-client';
import { IntegrationHelpButton, type IntegrationHelp } from './IntegrationHelpButton';
import { IntegrationTestButton, type IntegrationTestResult } from './IntegrationTestButton';
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

const INTEGRATION_HELP: Record<string, IntegrationHelp> = {
  whatsapp: {
    title: 'WhatsApp (Mega API)',
    required: ['URL base da Mega API', 'Token de autorizacao', 'Nome/chave da instancia WhatsApp'],
    steps: [
      'Acesse o painel da Mega API e abra a instancia do cliente.',
      'Copie a URL base da API. Use apenas o dominio/base, sem rota de envio no final.',
      'Copie o token de autorizacao da conta ou instancia.',
      'Copie o nome/chave da instancia que sera usada para conectar o WhatsApp.',
      'Salve os campos no painel e clique em Solicitar QR quando a instancia estiver desconectada.',
    ],
    validation: [
      'O card deve mostrar WhatsApp conectado depois que o QR for lido.',
      'A URL e a instancia aparecem no bloco de status do card.',
      'Se o QR nao aparecer, confira URL, token e instancia.',
    ],
    links: [
      { label: 'Mega API', href: 'https://megaapi.io/' },
      { label: 'Documentacao Mega API', href: 'https://mega-api.app.br/documentacao/start/' },
    ],
  },
  gcal: {
    title: 'Google Calendar',
    required: [
      'Projeto no Google Cloud com Google Calendar API habilitada',
      'OAuth Client ID e Client Secret do tipo Web application',
      'Redirect URI autorizado: https://developers.google.com/oauthplayground',
      'Conta Google que possui acesso de escrita na agenda',
      'Refresh token OAuth',
      'Calendar ID principal',
    ],
    steps: [
      'No Google Cloud Console, crie ou escolha o projeto usado pela aplicacao.',
      'Em APIs & Services > Library, habilite Google Calendar API.',
      'Em APIs & Services > OAuth consent screen, configure a tela de consentimento. Se estiver em Testing, adicione o e-mail da agenda em Test users.',
      'Em APIs & Services > Credentials, crie um OAuth Client ID do tipo Web application.',
      'No OAuth Client, adicione este Authorized redirect URI: https://developers.google.com/oauthplayground',
      'Abra o OAuth 2.0 Playground. No icone de engrenagem, marque Use your own OAuth credentials e cole Client ID e Client Secret.',
      'Ainda na engrenagem, deixe OAuth flow como Server-side e Access type como Offline.',
      'Na lista de scopes, informe https://www.googleapis.com/auth/calendar e clique Authorize APIs.',
      'Entre com a conta Google que possui acesso a agenda e aceite o consentimento.',
      'No passo 2 do OAuth Playground, clique Exchange authorization code for tokens.',
      'Copie o campo refresh_token. Se ele nao aparecer, revogue o acesso do app na Conta Google e repita com Access type Offline.',
      'No Google Calendar, abra Configuracoes da agenda > Integrar agenda e copie o ID da agenda.',
      'Cole Conta Google, Refresh token e Calendar ID principal no painel.',
    ],
    validation: [
      'O Calendar ID pode ser primary ou o e-mail/ID da agenda.',
      'O refresh token deve pertencer a uma conta com acesso de escrita na agenda.',
      'Se o OAuth consent estiver em Testing, o refresh token pode expirar; para producao, publique/verifique o app conforme a politica do Google.',
      'Se o refresh_token nao vier, normalmente a conta ja autorizou esse client antes. Remova o acesso em myaccount.google.com/permissions e gere novamente.',
      'Se o teste retornar deleted_client, o Client ID usado no backend foi apagado/desativado ou o token foi gerado com um Client ID antigo. Atualize GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET e gere um novo refresh token com essas mesmas credenciais.',
      'Teste criando um agendamento pelo bot ou simulador.',
    ],
    links: [
      { label: 'Google Calendar API', href: 'https://developers.google.com/calendar/api/guides/overview' },
      { label: 'OAuth 2.0 Google', href: 'https://developers.google.com/identity/protocols/oauth2' },
      { label: 'OAuth Web Server Flow', href: 'https://developers.google.com/identity/protocols/oauth2/web-server' },
      { label: 'OAuth Playground', href: 'https://developers.google.com/oauthplayground/' },
      { label: 'Permissoes da Conta Google', href: 'https://myaccount.google.com/permissions' },
    ],
  },
  chatwoot: {
    title: 'Chatwoot',
    required: ['URL do Chatwoot', 'API access token', 'Account ID', 'Inbox ID'],
    steps: [
      'Entre no Chatwoot com um usuario administrador ou agente com permissao.',
      'Em Profile Settings, gere ou copie o API access token.',
      'Pegue o Account ID na URL do painel ou na rota da conta.',
      'Abra Settings > Inboxes e copie o ID da inbox usada no atendimento.',
      'Cole URL, token, Account ID e Inbox ID no painel.',
    ],
    validation: [
      'O bot deve conseguir criar contato/conversa no Chatwoot.',
      'Handoff deve enviar a conversa para a inbox configurada.',
      'Erro 403 geralmente indica token sem permissao ou Account ID errado.',
    ],
    links: [
      { label: 'Chatwoot API', href: 'https://developers.chatwoot.com/api-reference/introduction' },
      { label: 'Inboxes API', href: 'https://developers.chatwoot.com/api-reference/inboxes/get-an-inbox' },
    ],
  },
  notion: {
    title: 'Notion',
    required: ['Token de integracao interna', 'Database ID do RAG', 'Database ID de leads se for usar leads'],
    steps: [
      'Acesse Notion Developers e crie uma integracao interna.',
      'Copie o internal integration token.',
      'Abra o database do RAG no Notion, copie o ID do database pela URL ou menu de compartilhamento.',
      'Compartilhe o database com a integracao criada, senao a API retorna nao encontrado.',
      'Repita o processo para o database de leads, se usado.',
    ],
    validation: [
      'O sync do RAG deve conseguir ler o database publicado.',
      'Se receber 404, normalmente o database nao foi compartilhado com a integracao.',
      'Se leads estiver ativo, envie um contato novo e confira a criacao no Notion.',
    ],
    links: [
      { label: 'Criar integracao Notion', href: 'https://developers.notion.com/docs/create-a-notion-integration' },
      { label: 'Autenticacao Notion', href: 'https://developers.notion.com/reference/authentication' },
      { label: 'Database API', href: 'https://developers.notion.com/reference/retrieve-database' },
    ],
  },
  nexfit: {
    title: 'Nexfit',
    required: ['URL base da API Nexfit', 'API key', 'Regra de elegibilidade desejada'],
    steps: [
      'Solicite ao cliente ou ao suporte Nexfit a credencial de API.',
      'Copie a URL base do ambiente informado para a integracao.',
      'Cole a API key no painel.',
      'Ative Verificar elegibilidade se o bot deve consultar o aluno antes de confirmar.',
      'Escolha se aluno inelegivel deve bloquear ou transferir para humano.',
    ],
    validation: [
      'Teste com um cliente elegivel e outro inelegivel.',
      'Se a API falhar, o erro deve aparecer na Fila de Erros.',
      'Confirme com o cliente qual regra operacional vale para inelegiveis.',
    ],
    links: [],
  },
  telegram: {
    title: 'Telegram',
    required: ['Bot token criado no BotFather', 'Chat ID do grupo ou usuario de alertas'],
    steps: [
      'No Telegram, abra o BotFather e crie um bot com /newbot.',
      'Copie o token retornado pelo BotFather.',
      'Adicione o bot ao grupo de alertas ou envie uma mensagem para ele.',
      'Use getUpdates ou uma ferramenta equivalente para descobrir o chat_id.',
      'Cole bot token e chat ID no painel.',
    ],
    validation: [
      'Dispare um alerta de teste ou force um erro controlado.',
      'O grupo deve receber a mensagem do bot.',
      'Se nao chegar, confira se o bot esta no grupo e se o chat ID inclui o sinal negativo quando for grupo.',
    ],
    links: [
      { label: 'BotFather', href: 'https://core.telegram.org/bots/features#botfather' },
      { label: 'Telegram Bot API', href: 'https://core.telegram.org/bots/api' },
    ],
  },
  asaas: {
    title: 'Asaas',
    required: ['URL da API', 'API key sandbox ou producao', 'Ambiente correto'],
    steps: [
      'Crie uma conta Sandbox para testes ou acesse a conta de producao do cliente.',
      'No painel Asaas, gere ou copie a API key do ambiente correto.',
      'Use URL sandbox para chave de sandbox e URL de producao para chave de producao.',
      'Cole API key e selecione o ambiente correspondente.',
      'Ative cobranca ao agendar se o bot deve gerar cobrancas automaticamente.',
    ],
    validation: [
      'No sandbox, crie uma cobranca de teste e confirme que o link foi gerado.',
      'Chave sandbox nao deve ser usada em URL de producao, nem o contrario.',
      'Falhas de cobranca devem aparecer na Fila de Erros.',
    ],
    links: [
      { label: 'Sandbox Asaas', href: 'https://docs.asaas.com/docs/sandbox-en' },
      { label: 'Autenticacao Asaas', href: 'https://docs.asaas.com/docs/authentication-2' },
    ],
  },
  canais: {
    title: 'Canais',
    required: ['Instagram Account ID se Instagram for usado', 'Messenger Page ID se Messenger for usado', 'Flags dos canais liberados'],
    steps: [
      'Confirme quais canais o cliente vai usar nesta fase.',
      'Copie o Instagram Account ID no painel/Meta Business usado pela integracao.',
      'Copie o Messenger Page ID da pagina conectada.',
      'Ative somente os canais ja homologados para o tenant.',
      'Mantenha TikTok desativado ate a validacao completa do webhook/canal.',
    ],
    validation: [
      'Eventos de canais ativos devem entrar normalizados como mensagens.',
      'Canais desativados nao devem processar webhooks.',
      'Teste cada canal separadamente antes de liberar ao cliente.',
    ],
    links: [
      { label: 'Meta for Developers', href: 'https://developers.facebook.com/docs/' },
    ],
  },
};

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

async function testIntegration(
  tenantId: string,
  slug: string,
  integration: string,
): Promise<IntegrationTestResult> {
  'use server';
  try {
    const result = await api.post<IntegrationTestResult>(`/api/tenants/${tenantId}/integrations/${integration}/test`);
    revalidatePath(`/${slug}/integracoes`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
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
  help,
  testAction,
  className = '',
  children,
}: {
  title: string;
  ok: boolean;
  help?: IntegrationHelp;
  testAction?: () => Promise<IntegrationTestResult>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`bg-white rounded-xl shadow-sm p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {help && <IntegrationHelpButton help={help} />}
          <StatusBadge ok={ok} />
        </div>
      </div>
      {children}
      {testAction && (
        <div className="border-t pt-3">
          <IntegrationTestButton action={testAction} />
        </div>
      )}
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
  const testAction = (integration: string) => testIntegration.bind(null, tenant.id, params.tenantSlug, integration);

  const hasSecret = (key: string) => typeof cfg[key] === 'object' && Boolean((cfg[key] as ConfigSecret).configured);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>

      <div className="grid gap-5 lg:grid-cols-3">
        <IntegrationCard title="WhatsApp (Mega API)" ok={waStatus.connected || Boolean(textValue(cfg['whatsapp.instance']))} help={INTEGRATION_HELP.whatsapp} testAction={testAction('whatsapp')} className="order-1">
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

        <IntegrationCard title="Google Calendar" ok={hasSecret('gcal.refresh_token') && Boolean(textValue(cfg['gcal.calendar_id']))} help={INTEGRATION_HELP.gcal} testAction={testAction('gcal')} className="order-2">
          <form action={saveAction} className="space-y-3">
            <Field label="Conta Google" name="gcal.account" cfg={cfg} placeholder="agenda@studio.com" />
            <Field label="Refresh token" name="gcal.refresh_token" cfg={cfg} />
            <Field label="Calendar ID principal" name="gcal.calendar_id" cfg={cfg} placeholder="primary" />
            <input type="hidden" name="$checkboxes" value="gcal.bidirectional_sync" />
            <Toggle label="Sync bidirecional ativo" name="gcal.bidirectional_sync" cfg={cfg} />
            <SaveButton />
          </form>
        </IntegrationCard>

        <IntegrationCard title="Asaas" ok={hasSecret('asaas.api_key')} help={INTEGRATION_HELP.asaas} testAction={testAction('asaas')} className="order-7">
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

        <IntegrationCard title="Nexfit" ok={hasSecret('nexfit.api_key')} help={INTEGRATION_HELP.nexfit} testAction={testAction('nexfit')} className="order-5">
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

        <IntegrationCard title="Notion" ok={hasSecret('notion.token') && Boolean(textValue(cfg['notion.database_id']) || textValue(cfg['notion.leads_database_id']))} help={INTEGRATION_HELP.notion} testAction={testAction('notion')} className="order-4">
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

        <IntegrationCard title="Chatwoot" ok={hasSecret('chatwoot.api_key') && Boolean(textValue(cfg['chatwoot.account_id']) && textValue(cfg['chatwoot.inbox_id']))} help={INTEGRATION_HELP.chatwoot} testAction={testAction('chatwoot')} className="order-3">
          <form action={saveAction} className="space-y-3">
            <Field label="URL" name="chatwoot.api_url" cfg={cfg} placeholder="https://chatwoot.seudominio.com" />
            <Field label="API key" name="chatwoot.api_key" cfg={cfg} />
            <Field label="Account ID" name="chatwoot.account_id" cfg={cfg} type="number" />
            <Field label="Inbox ID" name="chatwoot.inbox_id" cfg={cfg} type="number" />
            <SaveButton />
          </form>
        </IntegrationCard>

        <IntegrationCard title="Telegram" ok={hasSecret('telegram.bot_token') && Boolean(textValue(cfg['telegram.alert_chat_id']))} help={INTEGRATION_HELP.telegram} testAction={testAction('telegram')} className="order-6">
          <form action={saveAction} className="space-y-3">
            <Field label="Bot token" name="telegram.bot_token" cfg={cfg} />
            <Field label="Chat ID de alertas" name="telegram.alert_chat_id" cfg={cfg} />
            <SaveButton />
          </form>
        </IntegrationCard>

        <IntegrationCard title="Canais" ok help={INTEGRATION_HELP.canais} testAction={testAction('canais')} className="order-8">
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
