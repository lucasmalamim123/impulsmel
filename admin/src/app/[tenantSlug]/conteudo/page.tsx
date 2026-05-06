export const dynamic = 'force-dynamic';

import { api } from '../../../lib/api';
import { createAdminClient } from '../../../lib/supabase/admin-client';
import { approveDocument, createDocument, rejectDocument, submitDocument, updateDocument } from './actions';

interface Props { params: { tenantSlug: string } }

interface KnowledgeDocument {
  id: string;
  title: string;
  category: string | null;
  content: string;
  status: 'draft' | 'pending_approval' | 'published' | 'rejected';
  rejected_reason: string | null;
  updated_at: string;
}

const STATUS_LABELS: Record<KnowledgeDocument['status'], string> = {
  draft: 'Rascunho',
  pending_approval: 'Aguardando aprovação',
  published: 'Publicado',
  rejected: 'Rejeitado',
};

export default async function ConteudoPage({ params }: Props) {
  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', params.tenantSlug).single();
  if (!tenant) return <div className="text-sm text-red-600">Tenant não encontrado.</div>;

  const { documents } = await api
    .get<{ documents: KnowledgeDocument[] }>(`/api/tenants/${tenant.id}/knowledge-documents`)
    .catch(() => ({ documents: [] }));

  const create = createDocument.bind(null, params.tenantSlug);

  return (
    <div className="space-y-6">
      <div>
        <p className="brand-eyebrow mb-1">Base de conhecimento</p>
        <h1 className="text-2xl font-bold text-gray-900">Conteúdos do RAG</h1>
        <p className="text-sm text-gray-500 mt-1">Clientes podem criar rascunhos; publicação exige aprovação do operador e reprocessa o RAG.</p>
      </div>

      <form action={create} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Novo conteúdo</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input name="title" required placeholder="Título" className="border rounded-lg px-3 py-2 text-sm sm:col-span-2" />
          <input name="category" placeholder="Categoria" defaultValue="geral" className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <textarea name="content" required rows={6} placeholder="FAQ, regras, políticas, informações operacionais..." className="w-full border rounded-lg px-3 py-2 text-sm resize-y" />
        <div className="flex gap-2">
          <button name="submit" value="false" className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50">Salvar rascunho</button>
          <button name="submit" value="true" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">Enviar para aprovação</button>
        </div>
      </form>

      <div className="space-y-4">
        {documents.map(doc => {
          const update = updateDocument.bind(null, params.tenantSlug, doc.id);
          const submit = submitDocument.bind(null, params.tenantSlug, doc.id);
          const approve = approveDocument.bind(null, params.tenantSlug, doc.id);
          const reject = rejectDocument.bind(null, params.tenantSlug, doc.id);

          return (
            <section key={doc.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="font-semibold text-gray-900">{doc.title}</p>
                  <p className="text-xs text-gray-400">{doc.category ?? 'geral'} · atualizado em {new Date(doc.updated_at).toLocaleString('pt-BR')}</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                  doc.status === 'published' ? 'bg-green-100 text-green-700' :
                  doc.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                  doc.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {STATUS_LABELS[doc.status]}
                </span>
              </div>

              <form action={update} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <input name="title" defaultValue={doc.title} className="border rounded-lg px-3 py-2 text-sm sm:col-span-2" />
                  <input name="category" defaultValue={doc.category ?? 'geral'} className="border rounded-lg px-3 py-2 text-sm" />
                </div>
                <textarea name="content" defaultValue={doc.content} rows={7} className="w-full border rounded-lg px-3 py-2 text-sm resize-y" />
                {doc.rejected_reason && <p className="text-xs text-red-600">{doc.rejected_reason}</p>}
                <div className="flex flex-wrap gap-2">
                  <button name="submit" value="false" className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50">Salvar</button>
                  <button name="submit" value="true" className="text-sm px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100">Enviar para aprovação</button>
                  {doc.status === 'draft' && (
                    <button formAction={submit} className="text-sm px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black">Solicitar aprovação</button>
                  )}
                  {doc.status === 'pending_approval' && (
                    <>
                      <button formAction={approve} className="text-sm px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">Aprovar e publicar</button>
                      <button formAction={reject} className="text-sm px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100">Rejeitar</button>
                    </>
                  )}
                </div>
              </form>
            </section>
          );
        })}

        {documents.length === 0 && <p className="text-sm text-gray-500">Nenhum conteúdo cadastrado ainda.</p>}
      </div>
    </div>
  );
}
