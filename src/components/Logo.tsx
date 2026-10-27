// Isotipo de Rutero: un trayecto, no un pin de mapa genérico. Origen
// (círculo hueco) → curva punteada → destino (círculo lleno). Ver la
// propuesta aprobada: https://claude.ai/artifact/LcrpwyiSx9sTpV9fKYDoEF
import { useId } from "react";

export type LogoTone = "gradient" | "light" | "dark";

interface LogoMarkProps {
  size?: number;
  tone?: LogoTone;
  className?: string;
}

export function LogoMark({ size = 32, tone = "gradient", className }: LogoMarkProps) {
  const gradientId = useId();
  const strokeColor = tone === "dark" ? "#0B2559" : "#FFFFFF";
  const bg =
    tone === "gradient" ? (
      <>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0B2559" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <rect width="52" height="52" rx="16" fill={`url(#${gradientId})`} />
      </>
    ) : tone === "light" ? (
      <rect width="52" height="52" rx="16" fill="#EDF1F9" />
    ) : null;

  return (
    <svg width={size} height={size} viewBox="0 0 52 52" role="img" aria-label="Rutero" className={className}>
      {bg}
      <circle cx="16" cy="36" r="4" fill="none" stroke={strokeColor} strokeWidth="2.4" />
      <path
        d="M18 34 C 24 20, 30 32, 37 17"
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <circle cx="38" cy="15" r="3.4" fill={strokeColor} />
    </svg>
  );
}

interface LogoProps {
  size?: number;
  tone?: LogoTone;
  wordmarkColor?: string;
  className?: string;
}

// Lockup completo (isotipo + wordmark). `wordmarkColor` por defecto es
// navy-900 (uso sobre fondos claros); pásale `--color-text-on-dark` al
// usarlo sobre un degradado.
export function Logo({ size = 32, tone = "gradient", wordmarkColor = "#0B2559", className }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} tone={tone} />
      <span className="font-sans text-xl font-extrabold tracking-tight" style={{ color: wordmarkColor }}>
        Rutero
      </span>
    </span>
  );
}
