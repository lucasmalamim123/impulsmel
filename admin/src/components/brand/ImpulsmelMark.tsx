import Image from 'next/image';

interface ImpulsmelMarkProps {
  compact?: boolean;
  inverted?: boolean;
}

export function ImpulsmelMark({ compact = false, inverted = false }: ImpulsmelMarkProps) {
  return (
    <div className={compact ? 'relative h-11 w-11' : 'relative h-20 w-52 max-w-full'}>
      <Image
        src="/brand/impulsmel-logo.png"
        alt="Impulsmel"
        fill
        priority
        sizes={compact ? '44px' : '208px'}
        className={`object-contain ${inverted ? 'drop-shadow-[0_1px_1px_rgba(255,255,255,0.28)]' : ''}`}
      />
    </div>
  );
}
