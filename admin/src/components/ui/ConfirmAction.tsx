'use client';

import { useRef, useState, useTransition } from 'react';

interface ConfirmActionProps {
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  confirmClassName?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}

export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  className = 'text-xs text-red-600 hover:underline disabled:opacity-50',
  confirmClassName = 'bg-red-600 text-white hover:bg-red-700',
  onConfirm,
  disabled,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);

  function confirm() {
    startTransition(async () => {
      await onConfirm();
      setOpen(false);
    });
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
        className={className}
      >
        {pending ? 'Aguarde...' : label}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar confirmação"
            className="fixed inset-0 z-40 cursor-default bg-black/5"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-4 text-left shadow-xl">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirm}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${confirmClassName}`}
              >
                {pending ? 'Processando...' : confirmLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}
