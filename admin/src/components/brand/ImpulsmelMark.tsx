interface ImpulsmelMarkProps {
  compact?: boolean;
  inverted?: boolean;
}

export function ImpulsmelMark({ compact = false, inverted = false }: ImpulsmelMarkProps) {
  return (
    <div
      className={`font-display font-extrabold tracking-[0.08em] ${
        compact ? 'text-base' : 'text-2xl'
      } ${inverted ? 'text-white' : 'text-[var(--dashboard-text)]'}`}
      aria-label="SISTEMA"
    >
      SISTEMA
    </div>
  );
}
