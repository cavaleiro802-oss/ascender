import { BookOpen, Flame } from "lucide-react";

interface Obra {
  id: number;
  title: string;
  coverUrl?: string | null;
  genres?: string | null;
  viewsWeek?: number;
  viewsTotal?: number;
  updatedAt?: Date | string;
}

interface Props {
  obra: Obra;
  onClick: () => void;
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "k";
  return String(n);
}

export default function ObraTile({ obra, onClick }: Props) {
  const genres = obra.genres
    ? (JSON.parse(obra.genres) as string[]).slice(0, 2)
    : [];

  return (
    <div onClick={onClick} className="obra-tile group cursor-pointer">
      {/* Capa */}
      <div className="relative aspect-[3/4] bg-secondary overflow-hidden">
        {obra.coverUrl ? (
          <img
            src={obra.coverUrl}
            alt={obra.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary to-black/50">
            <BookOpen className="w-8 h-8 text-white/20" />
          </div>
        )}

        {/* Badge de views semanais */}
        {(obra.viewsWeek ?? 0) > 0 && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5">
            <Flame className="w-2.5 h-2.5 text-orange-400" />
            <span className="text-[10px] text-white font-bold">{fmt(obra.viewsWeek ?? 0)}</span>
          </div>
        )}

        {/* Overlay no hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-semibold text-white leading-tight line-clamp-2">{obra.title}</p>
        {genres.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{genres.join(" · ")}</p>
        )}
      </div>
    </div>
  );
}
