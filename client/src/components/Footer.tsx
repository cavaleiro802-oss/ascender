import { trpc } from "@/lib/trpc";
import { Mail, Send } from "lucide-react";

export default function Footer() {
  const { data: telegramLink } = trpc.admin.getPublicLink.useQuery({ key: "telegram" });
  const { data: emailLink } = trpc.admin.getPublicLink.useQuery({ key: "email_contato" });

  const temContato = telegramLink?.value || emailLink?.value;

  if (!temContato) return null;

  return (
    <footer className="border-t border-border mt-16 py-8 bg-black/20">
      <div className="container">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3 L22 21 H2 L12 3 Z" stroke="rgba(255,27,27,.95)" strokeWidth="1.8" />
            </svg>
            <span className="font-black text-sm tracking-widest uppercase text-white/60">ASCENDER</span>
          </div>

          {/* Links de contato */}
          <div className="flex items-center gap-4">
            {emailLink?.value && (
              <a
                href={`mailto:${emailLink.value}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                {emailLink.value}
              </a>
            )}
            {telegramLink?.value && (
              <a
                href={telegramLink.value}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Telegram
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
