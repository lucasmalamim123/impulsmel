'use client';

import { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';

export interface IntegrationHelp {
  title: string;
  required: string[];
  steps: string[];
  validation: string[];
  links: Array<{ label: string; href: string }>;
}

export function IntegrationHelpButton({ help }: { help: IntegrationHelp }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold text-[#d91e2e] hover:underline"
      >
        Como configurar
      </button>

      <Modal
        open={open}
        title={`Configurar ${help.title}`}
        description="Passo a passo para localizar os dados e preencher esta integração."
        size="lg"
        onClose={() => setOpen(false)}
      >
        <div className="space-y-6 text-sm text-gray-700">
          <section>
            <h3 className="text-xs font-bold uppercase text-gray-900 mb-2">Voce vai precisar de</h3>
            <ul className="space-y-1.5">
              {help.required.map(item => <li key={item}>• {item}</li>)}
            </ul>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase text-gray-900 mb-2">Passo a passo</h3>
            <ol className="space-y-2 list-decimal pl-5">
              {help.steps.map(item => <li key={item}>{item}</li>)}
            </ol>
          </section>

          <section>
            <h3 className="text-xs font-bold uppercase text-gray-900 mb-2">Como validar</h3>
            <ul className="space-y-1.5">
              {help.validation.map(item => <li key={item}>• {item}</li>)}
            </ul>
          </section>

          {help.links.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase text-gray-900 mb-2">Links uteis</h3>
              <div className="flex flex-wrap gap-2">
                {help.links.map(link => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#d91e2e] hover:text-[#d91e2e]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
          )}

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
            Nunca cole chaves sensiveis em conversas ou documentos. Depois de salvar, o painel mascara o valor e nao exibe a chave completa novamente.
          </div>
        </div>
      </Modal>
    </>
  );
}
