import { useAuth } from "@/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Bell, BookOpen, ChevronDown, Copy, Library, LogIn, LogOut, Plus, Shield, User } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import PedidoCargoModal from "./PedidoCargoModal";
import NotificacoesPanel from "./NotificacoesPanel";

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  usuario: { label: "Usuário", cls: "asc-badge-blue" },
  tradutor_aprendiz: { label: "Trad. Aprendiz", cls: "asc-badge-yellow" },
  tradutor_oficial: { label: "Trad. Oficial", cls: "asc-badge-green" },
  admin: { label: "Admin", cls: "asc-badge-red" },
  admin_supremo: { label: "Admin Supremo", cls: "asc-badge-purple" },
};

export default function Topbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [showPedidoModal, setShowPedidoModal] = useState(false);
  const [showNotificacoes, setShowNotificacoes] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "admin_supremo";
  const isTranslator = user?.role === "tradutor_aprendiz" || user?.role === "tradutor_oficial" || isAdmin;
  const isUsuarioComum = user?.role === "usuario";
  const roleInfo = user?.role ? ROLE_LABELS[user.role] : null;

  const { data: minhasObras = [] } = trpc.obras.minhas.useQuery(undefined, { enabled: isTranslator });
  const { data: naoLidas = 0 } = trpc.notificacoes.countNaoLidas.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  return (
    <>
      <header className="asc-topbar sticky top-0 z-50 w-full">
        <div className="container flex h-16 items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 select-none">
            <span className="asc-brand-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 3 L22 21 H2 L12 3 Z" stroke="rgba(255,27,27,.95)" strokeWidth="1.8" />
                <path d="M12 7.2 L18.6 20 H5.4 L12 7.2 Z" stroke="rgba(255,27,27,.35)" strokeWidth="1.2" />
                <path d="M12 3 L22 21" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
                <path d="M12 3 L2 21" stroke="rgba(255,255,255,.10)" strokeWidth="1" />
              </svg>
            </span>
            <span className="font-black text-lg tracking-widest uppercase text-white">ASCENDER</span>
          </Link>

          {/* Nav (desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" size="sm" className={`text-white/70 hover:text-white hover:bg-white/5 ${location === "/" ? "text-white bg-white/5" : ""}`}>
                <BookOpen className="w-4 h-4 mr-1.5" />Catálogo
              </Button>
            </Link>
            {isAuthenticated && (
              <Link href="/biblioteca">
                <Button variant="ghost" size="sm" className={`text-white/70 hover:text-white hover:bg-white/5 ${location === "/biblioteca" ? "text-white bg-white/5" : ""}`}>
                  <Library className="w-4 h-4 mr-1.5" />Biblioteca
                </Button>
              </Link>
            )}
            {isTranslator && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/5 gap-1">
                    <Plus className="w-4 h-4" />Criar<ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-card border-border text-white w-56">
                  <DropdownMenuItem className="cursor-pointer hover:bg-white/5" onClick={() => navigate("/nova-obra")}>
                    <BookOpen className="w-4 h-4 mr-2 text-primary" />Nova Obra
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <div className="px-2 py-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Novo Capítulo em...</p>
                  </div>
                  {minhasObras.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground italic">Sem obras cadastradas.</div>
                  ) : (
                    minhasObras.map((obra) => (
                      <DropdownMenuItem key={obra.id} className="cursor-pointer hover:bg-white/5 flex-col items-start gap-0"
                        onClick={() => navigate(`/obra/${obra.id}/novo-capitulo`)}>
                        <span className="text-sm text-white/90 truncate w-full">{obra.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {obra.status === "aprovada" ? "✅ Aprovada" : obra.status === "em_espera" ? "⏳ Pendente" : "❌ Rejeitada"}
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" className={`text-white/70 hover:text-white hover:bg-white/5 ${location.startsWith("/admin") ? "text-white bg-white/5" : ""}`}>
                  <Shield className="w-4 h-4 mr-1.5" />Admin
                </Button>
              </Link>
            )}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {roleInfo && <span className={`asc-badge ${roleInfo.cls} hidden sm:inline-flex`}>{roleInfo.label}</span>}

                {/* ✅ Sino de notificações */}
                <Button variant="ghost" size="icon"
                  className="relative rounded-full text-white/70 hover:text-white hover:bg-white/5"
                  onClick={() => setShowNotificacoes(true)}>
                  <Bell className="w-5 h-5" />
                  {naoLidas > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                      {naoLidas > 9 ? "9+" : naoLidas}
                    </span>
                  )}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full text-white/70 hover:text-white hover:bg-white/5">
                      <User className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border text-foreground w-52">
                    <div className="px-3 py-2">
                      <p className="text-sm font-semibold text-white">{user?.displayName || user?.name || "Usuário"}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                      <button className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors group"
                        onClick={(e) => {
                          e.preventDefault(); e.stopPropagation();
                          navigator.clipboard.writeText(String(user?.id ?? ""));
                          const el = e.currentTarget.querySelector("span");
                          if (el) { el.textContent = "Copiado!"; setTimeout(() => { el.textContent = `ID: #${user?.id}`; }, 1500); }
                        }}>
                        <Copy className="w-3 h-3 group-hover:text-primary" /><span>ID: #{user?.id}</span>
                      </button>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/perfil" className="cursor-pointer"><User className="w-4 h-4 mr-2" /> Meu Perfil</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/biblioteca" className="cursor-pointer"><Library className="w-4 h-4 mr-2" /> Minha Biblioteca</Link>
                    </DropdownMenuItem>

                    {/* ✅ Botão quero ser tradutor só para usuário comum */}
                    {isUsuarioComum && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer" onClick={() => setShowPedidoModal(true)}>
                          <span className="text-yellow-400">✏️ Quero ser Tradutor</span>
                        </DropdownMenuItem>
                      </>
                    )}

                    {isTranslator && (
                      <>
                        <DropdownMenuItem onClick={() => navigate("/nova-obra")} className="cursor-pointer">
                          <BookOpen className="w-4 h-4 mr-2 text-primary" /> Nova Obra
                        </DropdownMenuItem>
                        {minhasObras.length > 0 && (
                          <>
                            <div className="px-3 pt-2 pb-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider">Novo cap. em...</p>
                            </div>
                            {minhasObras.map((obra) => (
                              <DropdownMenuItem key={obra.id} className="cursor-pointer flex-col items-start gap-0 pl-5"
                                onClick={() => navigate(`/obra/${obra.id}/novo-capitulo`)}>
                                <span className="text-sm text-white/90 truncate w-full">{obra.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {obra.status === "aprovada" ? "✅ Aprovada" : obra.status === "em_espera" ? "⏳ Pendente" : "❌ Rejeitada"}
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </>
                    )}
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer"><Shield className="w-4 h-4 mr-2" /> Painel Admin</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logout()} className="text-red-400 cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" /> Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-semibold"
                onClick={() => (window.location.href = getLoginUrl())}>
                <LogIn className="w-4 h-4 mr-1.5" />Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      {showPedidoModal && <PedidoCargoModal onClose={() => setShowPedidoModal(false)} />}
      {showNotificacoes && <NotificacoesPanel onClose={() => setShowNotificacoes(false)} />}
    </>
  );
}
