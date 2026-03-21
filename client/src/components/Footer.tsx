import { trpc } from "@/lib/trpc";
import { Mail, Send } from "lucide-react";

export default function Footer() {
  const { data: telegramLink } = trpc.admin.getPublicLink.useQuery({ key: "telegram" });
  const { data: emailLink } = trpc.admin.getPublicLink.useQuery({ key: "email_contato" });
  const { data: discordLink } = trpc.admin.getPublicLink.useQuery({ key: "discord" });

  const temContato = telegramLink?.value || emailLink?.value || discordLink?.value;

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
            {discordLink?.value && (
              <a
                href={discordLink.value}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-indigo-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.045.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                Discord
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
