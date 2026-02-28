/**
 * AscenderLoader — tela/componente de loading com a pirâmide animada do ASCENDER.
 * Use <AscenderLoader /> para tela cheia ou <AscenderLoader inline /> para inline.
 */
export default function AscenderLoader({
  inline = false,
  text = "Carregando...",
}: {
  inline?: boolean;
  text?: string;
}) {
  if (inline) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <PyramidIcon />
        <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <PyramidIcon size="lg" />
      <p className="mt-4 text-sm text-muted-foreground animate-pulse">{text}</p>
    </div>
  );
}

function PyramidIcon({ size = "md" }: { size?: "md" | "lg" }) {
  const s = size === "lg" ? 64 : 40;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="ascender-pyramid-spin"
      style={{ filter: "drop-shadow(0 0 8px #ff1b1b88)" }}
    >
      {/* Pirâmide — triângulo principal */}
      <polygon
        points="20,4 36,34 4,34"
        fill="none"
        stroke="#ff1b1b"
        strokeWidth="2.5"
        strokeLinejoin="round"
        className="ascender-pyramid-stroke"
      />
      {/* Linha horizontal central */}
      <line
        x1="10"
        y1="22"
        x2="30"
        y2="22"
        stroke="#ff1b1b"
        strokeWidth="1.5"
        opacity="0.6"
      />
      {/* Ponto do topo */}
      <circle cx="20" cy="4" r="2" fill="#ff1b1b" />

      <style>{`
        @keyframes ascPyramidPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.92); }
        }
        @keyframes ascStrokeDash {
          0% { stroke-dashoffset: 120; }
          100% { stroke-dashoffset: 0; }
        }
        .ascender-pyramid-spin {
          animation: ascPyramidPulse 1.4s ease-in-out infinite;
          transform-origin: center;
        }
        .ascender-pyramid-stroke {
          stroke-dasharray: 120;
          animation: ascStrokeDash 1.4s ease-in-out infinite;
        }
      `}</style>
    </svg>
  );
}