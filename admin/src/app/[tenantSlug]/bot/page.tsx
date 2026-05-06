export const dynamic = 'force-dynamic';

import { api } from '../../../lib/api';
import { createAdminClient } from '../../../lib/supabase/admin-client';
import { publishBotPrompt, rollbackBotPrompt } from './actions';

interface Props { params: { tenantSlug: string } }

type ConfigValue = string | number | boolean | { configured?: boolean; maskedValue?: string } | undefined;

interface PromptVersion {
  id: string;
  version: number;
  status: string;
  fields: Record<string, string>;
  published_at: string | null;
  created_at: string;
}

function textValue(value: ConfigValue): string {
  return typeof value === 'string' ? value : '';
}

export default async function BotPage({ params }: Props) {
  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', params.tenantSlug).single();
  if (!tenant) return <div className="text-sm text-red-600">Tenant não encontrado.</div>;

  const { config, versions } = await api
    .get<{ config: Record<string, ConfigValue>; versions: PromptVersion[] }>(`/api/tenants/${tenant.id}/prompt`)
    .catch(() => ({ config: {}, versions: [] }));

  const publish = publishBotPrompt.bind(null, params.tenantSlug);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="brand-eyebrow mb-1">Prompt por cliente</p>
          <h1 className="text-2xl font-bold text-gray-900">Identidade do Bot</h1>
          <p className="text-sm text-gray-500 mt-1">O prompt base permanece travado; estes campos entram como configuração versionada do tenant.</p>
        </div>
        <a href={`/${params.tenantSlug}/conteudo`} className="brand-button">Base de conhecimento</a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form action={publish} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Nome do assistente</span>
              <input name="bot_name" defaultValue={textValue(config['bot.name']) || 'Sofia'} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Nome do studio</span>
              <input name="studio_name" defaultValue={textValue(config['bot.studio_name'])} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Tom de comunicação</span>
            <select name="tone" defaultValue={textValue(config['bot.tone']) || 'friendly'} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="friendly">Amigável</option>
              <option value="formal">Formal</option>
              <option value="young">Jovem / descolado</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Mensagem de boas-vindas</span>
            <textarea name="welcome_message" rows={3} defaultValue={textValue(config['bot.welcome_message'])} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Mensagem de handoff</span>
            <textarea name="handoff_message" rows={2} defaultValue={textValue(config['bot.handoff_message']) || 'Vou te conectar com um atendente. Em breve alguém entra em contato! 😊'} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Regras extras do cliente</span>
            <textarea name="extra_rules" rows={6} defaultValue={textValue(config['bot.extra_rules'])} className="w-full border rounded-lg px-3 py-2 text-sm resize-y" placeholder="Ex: nunca oferecer aula experimental aos domingos; transferir planos corporativos para humano." />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Notas de comportamento</span>
            <textarea name="behavior_notes" rows={5} defaultValue={textValue(config['bot.behavior_notes'])} className="w-full border rounded-lg px-3 py-2 text-sm resize-y" placeholder="Preferências de linguagem e atendimento específicas do studio." />
          </label>

          <button type="submit" className="bg-blue-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Publicar nova versão
          </button>
        </form>

        <aside className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Histórico de versões</h2>
          <div className="space-y-3">
            {versions.map(version => {
              const rollback = rollbackBotPrompt.bind(null, params.tenantSlug, version.version);
              return (
                <div key={version.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">v{version.version}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${version.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {version.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{new Date(version.published_at ?? version.created_at).toLocaleString('pt-BR')}</p>
                  {version.status !== 'published' && (
                    <form action={rollback} className="mt-3">
                      <button className="text-xs px-3 py-1 rounded-lg border hover:bg-gray-50">Restaurar</button>
                    </form>
                  )}
                </div>
              );
            })}
            {versions.length === 0 && <p className="text-sm text-gray-500">Nenhuma versão publicada ainda.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
