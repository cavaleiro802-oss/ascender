import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  BarChart3, BookOpen, Check, FileText, Flag,
  Link2, Shield, Users, X, UserCheck,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import Topbar from "@/components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import AdminReportsTab from "@/components/AdminReportsTab";
import AdminPedidosCargoTab from "@/components/AdminPedidosCargoTab";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(".0", "") + "k";
  return String(n);
}

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  usuario: { label: "Usuário", cls: "asc-badge-blue" },
  tradutor_aprendiz: { label: "Trad. Aprendiz", cls: "asc-badge-yellow" },
  tradutor_oficial: { label: "Trad. Oficial", cls: "asc-badge-green" },
  admin: { label: "Admin", cls: "asc-badge-red" },
  admin_supremo: { label: "Admin Supremo", cls: "asc-badge-purple" },
};

export default function AdminPage() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { tab } = useParams<{ tab?: string }>();

  const isAdmin = user?.role === "admin" || user?.role === "admin_supremo";
  const isSupreme = user?.role === "admin_supremo";

  const { data: stats } = trpc.admin.stats.useQuery({ enabled: isAdmin } as any);

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <div className="container py-20 text-center">
          <Shield className="w-12 h-12 text-primary/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-black text-white">Painel Administrativo</h1>
          <span className={`asc-badge ${ROLE_LABELS[user.role]?.cls}`}>{ROLE_LABELS[user.role]?.label}</span>
        </div>

        <Tabs defaultValue={tab ?? "stats"}>
          <TabsList className="bg-secondary border-border mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="stats" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-1.5" />Stats
            </TabsTrigger>
            <TabsTrigger value="obras" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <BookOpen className="w-4 h-4 mr-1.5" />Obras
            </TabsTrigger>
            <TabsTrigger value="capitulos" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <FileText className="w-4 h-4 mr-1.5" />Capítulos
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Users className="w-4 h-4 mr-1.5" />Usuários
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="data-[state=active]:bg-primary data-[state=active]:text-white relative">
              <UserCheck className="w-4 h-4 mr-1.5" />Pedidos de Cargo
              {(stats?.pendingPedidos ?? 0) > 0 && (
                <span className="ml-1.5 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {stats?.pendingPedidos}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Flag className="w-4 h-4 mr-1.5" />Denúncias
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <FileText className="w-4 h-4 mr-1.5" />Logs
            </TabsTrigger>
            <TabsTrigger value="links" className="data-[state=active]:bg-primary data-[state=active]:text-white">
              <Link2 className="w-4 h-4 mr-1.5" />Links & Contato
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats"><StatsTab /></TabsContent>
          <TabsContent value="obras"><ObrasTab isSupreme={isSupreme} /></TabsContent>
          <TabsContent value="capitulos"><CapitulosTab /></TabsContent>
          <TabsContent value="usuarios"><UsuariosTab isSupreme={isSupreme} currentUserId={user.id} /></TabsContent>
          <TabsContent value="pedidos"><AdminPedidosCargoTab /></TabsContent>
          <TabsContent value="reports"><AdminReportsTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
          <TabsContent value="links"><LinksTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab() {
  const { data: stats } = trpc.admin.stats.useQuery();
  const cards = [
    { label: "Obras Publicadas",    value: stats?.totalObras    ?? 0, color: "text-green-400" },
    { label: "Capítulos Aprovados", value: stats?.totalCaps     ?? 0, color: "text-blue-400" },
    { label: "Usuários Registrados",value: stats?.totalUsers    ?? 0, color: "text-purple-400" },
    { label: "Obras Pendentes",     value: stats?.pendingObras  ?? 0, color: "text-yellow-400" },
    { label: "Caps. Pendentes",     value: stats?.pendingCaps   ?? 0, color: "text-orange-400" },
    { label: "Pedidos de Cargo",    value: stats?.pendingPedidos?? 0, color: "text-pink-400" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="asc-card p-4 text-center">
          <p className={`text-3xl font-black ${c.color}`}>{fmt(c.value)}</p>
          <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Obras Tab ────────────────────────────────────────────────────────────────
function ObrasTab({ isSupreme }: { isSupreme: boolean }) {
  const utils = trpc.useUtils();
  const { data: pending = [] } = trpc.obras.pending.useQuery();
  const { data: allObras = [] } = trpc.obras.listAll.useQuery({ status: "aprovada" });
  const [changeAuthorObraId, setChangeAuthorObraId] = useState<number | null>(null);
  const [newAuthorId, setNewAuthorId] = useState("");
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const approve = trpc.obras.approve.useMutation({
    onSuccess: () => { utils.obras.pending.invalidate(); toast.success("Obra atualizada!"); },
    onError: (e) => toast.error(e.message),
  });
  const changeAuthor = trpc.obras.changeAuthor.useMutation({
    onSuccess: () => { setChangeAuthorObraId(null); setNewAuthorId(""); toast.success("Dono da obra atualizado!"); },
    onError: (e) => toast.error(e.message),
  });

  const renderObraCard = (obra: any, showApproveButtons = false) => (
    <div key={obra.id} className="asc-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white">{obra.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dono ID: {obra.authorId} • Status: {obra.status} • {new Date(obra.createdAt).toLocaleDateString("pt-BR")}
          </p>
          {obra.synopsis && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{obra.synopsis}</p>}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {showApproveButtons && (
            <>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => approve.mutate({ id: obra.id, status: "aprovada" })} disabled={approve.isPending}>
                <Check className="w-3.5 h-3.5 mr-1" /> Aprovar
              </Button>
              <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent"
                onClick={() => approve.mutate({ id: obra.id, status: "rejeitada" })} disabled={approve.isPending}>
                <X className="w-3.5 h-3.5 mr-1" /> Rejeitar
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className="border-border bg-transparent text-white/60 text-xs"
            onClick={() => setChangeAuthorObraId(changeAuthorObraId === obra.id ? null : obra.id)}>
            Trocar Dono
          </Button>
        </div>
      </div>
      {changeAuthorObraId === obra.id && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Digite o ID do novo tradutor responsável:</p>
          <div className="flex gap-2">
            <Input value={newAuthorId} onChange={(e) => setNewAuthorId(e.target.value)}
              placeholder="ID do novo tradutor (ex: 42)" className="bg-secondary border-border text-white text-sm" />
            <Button size="sm" className="bg-primary text-white"
              onClick={() => changeAuthor.mutate({ obraId: obra.id, newAuthorId: parseInt(newAuthorId) })}
              disabled={!newAuthorId || changeAuthor.isPending}>Confirmar</Button>
            <Button size="sm" variant="ghost" className="text-white/60" onClick={() => setChangeAuthorObraId(null)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2 mb-4">
        <Button size="sm" onClick={() => setTab("pending")}
          className={tab === "pending" ? "bg-primary text-white" : "bg-secondary text-white/60 border-border border"}>
          Pendentes ({pending.length})
        </Button>
        <Button size="sm" onClick={() => setTab("all")}
          className={tab === "all" ? "bg-primary text-white" : "bg-secondary text-white/60 border-border border"}>
          Todas ({allObras.length})
        </Button>
      </div>
      {tab === "pending" && (
        pending.length === 0 ? (
          <div className="asc-card p-8 text-center text-muted-foreground">Nenhuma obra aguardando aprovação.</div>
        ) : (
          <div className="space-y-3">{pending.map((obra: any) => renderObraCard(obra, true))}</div>
        )
      )}
      {tab === "all" && (
        allObras.length === 0 ? (
          <div className="asc-card p-8 text-center text-muted-foreground">Nenhuma obra aprovada ainda.</div>
        ) : (
          <div className="space-y-3">{allObras.map((obra: any) => renderObraCard(obra, false))}</div>
        )
      )}
    </div>
  );
}

// ─── Capítulos Tab ────────────────────────────────────────────────────────────
function CapitulosTab() {
  const utils = trpc.useUtils();
  const { data: pending = [] } = trpc.capitulos.pending.useQuery();
  const approve = trpc.capitulos.approve.useMutation({
    onSuccess: () => { utils.capitulos.pending.invalidate(); toast.success("Capítulo atualizado!"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">
        Capítulos Pendentes ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <div className="asc-card p-8 text-center text-muted-foreground">Nenhum capítulo aguardando.</div>
      ) : (
        pending.map((cap: any) => (
          <div key={cap.id} className="asc-card p-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white">Obra #{cap.obraId} — Cap. {cap.numero}{cap.title && `: ${cap.title}`}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tradutor ID: {cap.authorId} • {new Date(cap.createdAt).toLocaleDateString("pt-BR")}</p>
              {cap.content && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{cap.content}</p>}
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => approve.mutate({ id: cap.id, status: "aprovado" })} disabled={approve.isPending}>
                <Check className="w-3.5 h-3.5 mr-1" /> Aprovar
              </Button>
              <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent"
                onClick={() => approve.mutate({ id: cap.id, status: "rejeitado" })} disabled={approve.isPending}>
                <X className="w-3.5 h-3.5 mr-1" /> Rejeitar
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Usuários Tab ─────────────────────────────────────────────────────────────
const ROLE_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "admin_supremo", label: "Admin Supremo" },
  { value: "admin", label: "Admin" },
  { value: "tradutor_oficial", label: "Trad. Oficial" },
  { value: "tradutor_aprendiz", label: "Trad. Aprendiz" },
  { value: "usuario", label: "Usuário" },
];

function UsuariosTab({ isSupreme, currentUserId }: { isSupreme: boolean; currentUserId: number }) {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [banTarget, setBanTarget] = useState<any>(null);
  const [banTipo, setBanTipo] = useState<"suave" | "total">("suave");

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => setDebouncedSearch(val), 400);
  };

  const { data: allUsers = [] } = trpc.admin.users.useQuery(
    { page: 1, search: debouncedSearch || undefined, role: roleFilter !== "todos" ? roleFilter : undefined },
    { keepPreviousData: true } as any
  );

  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => { utils.admin.users.invalidate(); toast.success("Cargo atualizado!"); },
    onError: (e) => toast.error(e.message),
  });

  const banUserMut = trpc.admin.banUser.useMutation({
    onSuccess: () => { utils.admin.users.invalidate(); toast.success("Usuário atualizado!"); setBanTarget(null); },
    onError: (e) => toast.error(e.message),
  });

  const availableRoles = isSupreme
    ? ["usuario", "tradutor_aprendiz", "tradutor_oficial", "admin"]
    : ["usuario", "tradutor_aprendiz", "tradutor_oficial"];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input value={search} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por ID ou nome..."
          className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
      </div>
      <div className="flex flex-wrap gap-2">
        {ROLE_FILTER_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => setRoleFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
              roleFilter === opt.value ? "bg-primary border-primary text-white" : "bg-transparent border-border text-white/60 hover:text-white hover:border-white/40"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">{allUsers.length} usuário(s)</h2>

      {allUsers.map((u: any) => {
        const roleInfo = ROLE_LABELS[u.role];
        const isSelf = u.id === currentUserId;
        const estaBanidoSuave = u.banned && !u.bannedTotal;
        const estaBanidoTotal = u.bannedTotal;
        return (
          <div key={u.id} className="asc-card p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-white">{u.displayName || u.name || "Sem nome"}</p>
                <span className={`asc-badge ${roleInfo?.cls}`}>{roleInfo?.label}</span>
                {estaBanidoTotal && <span className="asc-badge asc-badge-red">🚫 Banido Total</span>}
                {estaBanidoSuave && <span className="asc-badge asc-badge-yellow">⚠️ Banido (só leitura)</span>}
                {isSelf && <span className="asc-badge asc-badge-blue">Você</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{u.email} • ID: {u.id}</p>
            </div>
            {!isSelf && (
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                <Select value={u.role} onValueChange={(role) => setRole.mutate({ userId: u.id, role: role as any })}>
                  <SelectTrigger className="w-36 bg-secondary border-border text-white text-sm h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-white">
                    {availableRoles.map((r) => (
                      <SelectItem key={r} value={r} className="text-white hover:bg-secondary">{ROLE_LABELS[r]?.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* ✅ Banimento suave */}
                {!estaBanidoSuave && !estaBanidoTotal && (
                  <Button size="sm" variant="outline" className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 text-xs"
                    onClick={() => { setBanTarget(u); setBanTipo("suave"); }}>
                    ⚠️ Banir (leitura)
                  </Button>
                )}

                {/* ✅ Banimento total */}
                {!estaBanidoTotal && (
                  <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs"
                    onClick={() => { setBanTarget(u); setBanTipo("total"); }}>
                    🚫 Banir (total)
                  </Button>
                )}

                {/* Desbanir */}
                {(estaBanidoSuave || estaBanidoTotal) && (
                  <Button size="sm" variant="outline" className="border-green-500/40 text-green-400 hover:bg-green-500/10 text-xs"
                    onClick={() => banUserMut.mutate({ userId: u.id, banned: false, total: false })}>
                    ✅ Desbanir
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Dialog confirmação de ban */}
      <AlertDialog open={!!banTarget} onOpenChange={(open) => { if (!open) setBanTarget(null); }}>
        <AlertDialogContent className="bg-card border-border text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {banTipo === "total" ? "🚫 Banimento Total" : "⚠️ Banimento Suave"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {banTipo === "total"
                ? `${banTarget?.displayName || banTarget?.name} ficará sem acesso a nada no site.`
                : `${banTarget?.displayName || banTarget?.name} poderá continuar lendo mas não poderá comentar, curtir, favoritar ou postar.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-transparent text-white/70 hover:bg-white/5">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={banTipo === "total" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-yellow-600 hover:bg-yellow-700 text-white"}
              onClick={() => banUserMut.mutate({ userId: banTarget.id, banned: true, total: banTipo === "total" })}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────
function LogsTab() {
  const { data: logs = [] } = trpc.admin.logs.useQuery({ page: 1 });
  const ACTION_LABELS: Record<string, string> = {
    aprovar_obra: "✅ Aprovou obra", rejeitar_obra: "❌ Rejeitou obra",
    aprovar_capitulo: "✅ Aprovou capítulo", rejeitar_capitulo: "❌ Rejeitou capítulo",
    alterar_role: "🔑 Alterou cargo", banir_suave: "⚠️ Banimento suave",
    banir_total: "🚫 Banimento total", desbanir_usuario: "✅ Desbaniu usuário",
    alterar_author_obra: "✏️ Trocou dono da obra", deletar_comentario: "🗑️ Deletou comentário",
    pedido_cargo_aprovado: "🎉 Aprovou pedido de cargo", pedido_cargo_rejeitado: "❌ Rejeitou pedido de cargo",
  };

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">Log de Ações ({logs.length})</h2>
      {logs.length === 0 ? (
        <div className="asc-card p-8 text-center text-muted-foreground">Nenhuma ação registrada ainda.</div>
      ) : (
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
          {logs.map((log: any) => (
            <div key={log.id} className="asc-card p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90">
                  {ACTION_LABELS[log.acao] ?? log.acao}
                  {log.targetType && log.targetId && (
                    <span className="text-muted-foreground ml-1">({log.targetType} #{log.targetId})</span>
                  )}
                </p>
                {log.detalhes && <p className="text-xs text-muted-foreground mt-0.5">{log.detalhes}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">Admin #{log.adminId}</p>
                <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Links Tab ────────────────────────────────────────────────────────────────
function LinksTab() {
  const [telegramUrl, setTelegramUrl] = useState("");
  const [emailContato, setEmailContato] = useState("");
  const { data: telegramLink } = trpc.admin.getPublicLink.useQuery({ key: "telegram" });
  const { data: emailLink } = trpc.admin.getPublicLink.useQuery({ key: "email_contato" });

  const setLink = trpc.admin.setPublicLink.useMutation({
    onSuccess: () => toast.success("Salvo com sucesso!"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Links & Contato</h2>

      <div className="asc-card p-5 space-y-6">
        {/* Telegram */}
        <div>
          <Label className="text-white/80 mb-1.5 block">Link do Telegram</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Mostrado para novos tradutores quando o pedido é aprovado.
          </p>
          {telegramLink && (
            <p className="text-xs text-green-400 mb-2">Atual: {telegramLink.value}</p>
          )}
          <div className="flex gap-2">
            <Input value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)}
              placeholder="https://t.me/..." className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
            <Button className="bg-primary hover:bg-primary/90 text-white flex-shrink-0"
              onClick={() => setLink.mutate({ key: "telegram", value: telegramUrl })}
              disabled={!telegramUrl.trim() || setLink.isPending}>Salvar</Button>
          </div>
        </div>

        {/* ✅ Email de contato */}
        <div>
          <Label className="text-white/80 mb-1.5 block">Email de Contato</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Aparece no rodapé do site para todos os visitantes.
          </p>
          {emailLink && (
            <p className="text-xs text-green-400 mb-2">Atual: {emailLink.value}</p>
          )}
          <div className="flex gap-2">
            <Input value={emailContato} onChange={(e) => setEmailContato(e.target.value)}
              placeholder="contato@seusite.com" type="email"
              className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
            <Button className="bg-primary hover:bg-primary/90 text-white flex-shrink-0"
              onClick={() => setLink.mutate({ key: "email_contato", value: emailContato })}
              disabled={!emailContato.trim() || setLink.isPending}>Salvar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
