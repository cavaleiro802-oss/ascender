import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  BarChart3, BookOpen, Check, FileText, Flag,
  Link2, Shield, Users, X, UserCheck, ShoppingBag,
  Plus, Eye, EyeOff, Upload, Trash2,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
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
  usuario:           { label: "Usuário",        cls: "asc-badge-blue"   },
  tradutor_aprendiz: { label: "Trad. Aprendiz", cls: "asc-badge-yellow" },
  tradutor_oficial:  { label: "Trad. Oficial",  cls: "asc-badge-green"  },
  criador:           { label: "Criador",         cls: "asc-badge-purple" },
  admin_senhor:      { label: "Admin",           cls: "asc-badge-red"    },
  admin_supremo:     { label: "Admin Supremo",   cls: "asc-badge-purple" },
};

export default function AdminPage() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { tab } = useParams<{ tab?: string }>();
  const isAdmin = user?.role === "admin_senhor" || user?.role === "admin_supremo";
  const isSupreme = user?.role === "admin_supremo";

  // ✅ CORRIGIDO: enabled como opção do hook, não como input
  const { data: stats } = trpc.admin.stats.useQuery(undefined, { enabled: isAdmin });

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
          <TabsList className="bg-secondary border-border mb-6 flex-wrap h-auto gap-1 w-full">
            <TabsTrigger value="stats"     className="data-[state=active]:bg-primary data-[state=active]:text-white"><BarChart3  className="w-4 h-4 mr-1.5" />Stats</TabsTrigger>
            <TabsTrigger value="obras"     className="data-[state=active]:bg-primary data-[state=active]:text-white"><BookOpen   className="w-4 h-4 mr-1.5" />Obras</TabsTrigger>
            <TabsTrigger value="capitulos" className="data-[state=active]:bg-primary data-[state=active]:text-white"><FileText   className="w-4 h-4 mr-1.5" />Capítulos</TabsTrigger>
            <TabsTrigger value="gerenciar-caps" className="data-[state=active]:bg-primary data-[state=active]:text-white"><Trash2 className="w-4 h-4 mr-1.5" />Gerenciar Caps</TabsTrigger>
            <TabsTrigger value="usuarios"  className="data-[state=active]:bg-primary data-[state=active]:text-white"><Users      className="w-4 h-4 mr-1.5" />Usuários</TabsTrigger>
            <TabsTrigger value="pedidos"   className="data-[state=active]:bg-primary data-[state=active]:text-white relative">
              <UserCheck className="w-4 h-4 mr-1.5" />Pedidos de Cargo
              {(stats?.pendingPedidos ?? 0) > 0 && (
                <span className="ml-1.5 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{stats?.pendingPedidos}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports"   className="data-[state=active]:bg-primary data-[state=active]:text-white"><Flag       className="w-4 h-4 mr-1.5" />Denúncias</TabsTrigger>
            <TabsTrigger value="logs"      className="data-[state=active]:bg-primary data-[state=active]:text-white"><FileText   className="w-4 h-4 mr-1.5" />Logs</TabsTrigger>
            <TabsTrigger value="links"     className="data-[state=active]:bg-primary data-[state=active]:text-white"><Link2      className="w-4 h-4 mr-1.5" />Links</TabsTrigger>
            {isSupreme && (
              <TabsTrigger value="loja" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                <ShoppingBag className="w-4 h-4 mr-1.5" />Loja
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="stats">    <StatsTab /></TabsContent>
          <TabsContent value="obras">    <ObrasTab isSupreme={isSupreme} /></TabsContent>
          <TabsContent value="capitulos"><CapitulosTab /></TabsContent>
          <TabsContent value="gerenciar-caps"><GerenciarCapsTab /></TabsContent>
          <TabsContent value="usuarios"> <UsuariosTab isSupreme={isSupreme} currentUserId={user.id} /></TabsContent>
          <TabsContent value="pedidos">  <AdminPedidosCargoTab /></TabsContent>
          <TabsContent value="reports">  <AdminReportsTab /></TabsContent>
          <TabsContent value="logs">     <LogsTab /></TabsContent>
          <TabsContent value="links">    <LinksTab /></TabsContent>
          {isSupreme && (
            <TabsContent value="loja">
              <LojaTabWrapper />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────
function StatsTab() {
  const { data: stats } = trpc.admin.stats.useQuery();
  const cards = [
    { label: "Obras Publicadas",     value: stats?.totalObras     ?? 0, color: "text-green-400"  },
    { label: "Capítulos Aprovados",  value: stats?.totalCaps      ?? 0, color: "text-blue-400"   },
    { label: "Usuários Registrados", value: stats?.totalUsers     ?? 0, color: "text-purple-400" },
    { label: "Obras Pendentes",      value: stats?.pendingObras   ?? 0, color: "text-yellow-400" },
    { label: "Caps. Pendentes",      value: stats?.pendingCaps    ?? 0, color: "text-orange-400" },
    { label: "Pedidos de Cargo",     value: stats?.pendingPedidos ?? 0, color: "text-pink-400"   },
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
  const [pageAll, setPageAll] = useState(1);
  const { data: pending = [] }  = trpc.obras.pending.useQuery();
  const { data: allObras = [] } = trpc.obras.listAll.useQuery({ status: "aprovada", page: pageAll });
  const [changeAuthorObraId, setChangeAuthorObraId] = useState<number | null>(null);
  const [newAuthorId, setNewAuthorId] = useState("");
  const [confirmDeleteObraId, setConfirmDeleteObraId] = useState<number | null>(null);
  const [tab, setTab] = useState<"pending" | "all" | "tradutor">("pending");
  const [buscaTradutor, setBuscaTradutor] = useState("");
  const [translatorIdBusca, setTranslatorIdBusca] = useState<number | null>(null);
  const { data: obrasTradutor = [] } = trpc.obras.byTranslatorId.useQuery(
    { translatorId: translatorIdBusca! },
    { enabled: translatorIdBusca !== null }
  );

  const approve      = trpc.obras.approve.useMutation({ onSuccess: () => { utils.obras.pending.invalidate(); utils.obras.listAll.invalidate(); toast.success("Obra atualizada!"); }, onError: (e) => toast.error(e.message) });
  const changeAuthor = trpc.obras.changeAuthor.useMutation({ onSuccess: () => { setChangeAuthorObraId(null); setNewAuthorId(""); toast.success("Dono atualizado!"); }, onError: (e) => toast.error(e.message) });
  const archive      = trpc.obras.archive.useMutation({ onSuccess: () => { utils.obras.listAll.invalidate(); utils.obras.pending.invalidate(); toast.success("Obra arquivada!"); }, onError: (e) => toast.error(e.message) });
  const deleteObra   = trpc.obras.deleteObra.useMutation({ onSuccess: () => { utils.obras.listAll.invalidate(); utils.obras.pending.invalidate(); toast.success("Obra deletada!"); setConfirmDeleteObraId(null); }, onError: (e) => toast.error(e.message) });

  const renderObraCard = (obra: any, showApprove = false) => (
    <div key={obra.id} className="asc-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white">{obra.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Dono ID: {obra.authorId} • {new Date(obra.createdAt).toLocaleDateString("pt-BR")}</p>
          {obra.synopsis && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{obra.synopsis}</p>}
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          {showApprove && (
            <>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approve.mutate({ id: obra.id, status: "aprovada" })} disabled={approve.isPending}><Check className="w-3.5 h-3.5 mr-1" />Aprovar</Button>
              <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent" onClick={() => approve.mutate({ id: obra.id, status: "rejeitada" })} disabled={approve.isPending}><X className="w-3.5 h-3.5 mr-1" />Rejeitar</Button>
            </>
          )}
          <Button size="sm" variant="outline" className="border-border bg-transparent text-white/60 text-xs" onClick={() => setChangeAuthorObraId(changeAuthorObraId === obra.id ? null : obra.id)}>Trocar Dono</Button>
          <Button size="sm" variant="outline" className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 bg-transparent text-xs" onClick={() => archive.mutate({ id: obra.id })} disabled={archive.isPending}>📦 Arquivar</Button>
          <Button size="sm" variant="outline" className="border-red-500/40 text-red-500 hover:bg-red-500/10 bg-transparent text-xs" onClick={() => setConfirmDeleteObraId(obra.id)}>🗑️ Deletar</Button>
        </div>
      </div>
      {/* Confirmação de deleção */}
      {confirmDeleteObraId === obra.id && (
        <div className="mt-3 pt-3 border-t border-red-500/30 bg-red-500/5 rounded-lg p-3">
          <p className="text-sm text-red-400 font-semibold mb-2">⚠️ Tem certeza? Essa ação é irreversível!</p>
          <div className="flex gap-2">
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteObra.mutate({ id: obra.id })} disabled={deleteObra.isPending}>Confirmar Deleção</Button>
            <Button size="sm" variant="ghost" className="text-white/60" onClick={() => setConfirmDeleteObraId(null)}>Cancelar</Button>
          </div>
        </div>
      )}
      {changeAuthorObraId === obra.id && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">ID do novo tradutor:</p>
          <div className="flex gap-2">
            <Input value={newAuthorId} onChange={(e) => setNewAuthorId(e.target.value)} placeholder="ex: 42" className="bg-secondary border-border text-white text-sm" />
            <Button size="sm" className="bg-primary text-white" onClick={() => changeAuthor.mutate({ obraId: obra.id, newAuthorId: parseInt(newAuthorId) })} disabled={!newAuthorId || changeAuthor.isPending}>OK</Button>
            <Button size="sm" variant="ghost" className="text-white/60" onClick={() => setChangeAuthorObraId(null)}>✕</Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button size="sm" onClick={() => setTab("pending")}  className={tab === "pending"  ? "bg-primary text-white" : "bg-secondary text-white/60 border-border border"}>Pendentes ({pending.length})</Button>
        <Button size="sm" onClick={() => setTab("all")}      className={tab === "all"      ? "bg-primary text-white" : "bg-secondary text-white/60 border-border border"}>Todas ({allObras.length})</Button>
        <Button size="sm" onClick={() => setTab("tradutor")} className={tab === "tradutor" ? "bg-purple-600 text-white" : "bg-secondary text-white/60 border-border border"}>Por Tradutor</Button>
      </div>

      {/* [11] Busca por ID do tradutor */}
      {tab === "tradutor" && (
        <div className="mb-4 space-y-3">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="ID do tradutor (ex: 42)"
              value={buscaTradutor}
              onChange={(e) => setBuscaTradutor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setTranslatorIdBusca(parseInt(buscaTradutor))}
              className="bg-secondary border-border text-white max-w-xs"
            />
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => {
                const id = parseInt(buscaTradutor);
                if (isNaN(id)) return toast.error("ID inválido.");
                setTranslatorIdBusca(id);
              }}
            >
              Buscar Obras
            </Button>
          </div>
          {translatorIdBusca !== null && (
            <p className="text-xs text-muted-foreground">
              Tradutor #{translatorIdBusca} — {obrasTradutor.length} obra(s)
            </p>
          )}
          {obrasTradutor.length === 0 && translatorIdBusca !== null ? (
            <div className="asc-card p-8 text-center text-muted-foreground">Nenhuma obra para esse tradutor.</div>
          ) : (
            obrasTradutor.map((o: any) => renderObraCard(o, false))
          )}
        </div>
      )}

      {tab === "pending" && (pending.length === 0 ? <div className="asc-card p-8 text-center text-muted-foreground">Nenhuma obra pendente.</div> : pending.map((o: any) => renderObraCard(o, true)))}
      {tab === "all" && (
        <>
          {allObras.length === 0 ? (
            <div className="asc-card p-8 text-center text-muted-foreground">Nenhuma obra aprovada.</div>
          ) : (
            allObras.map((o: any) => renderObraCard(o, false))
          )}
          <div className="flex items-center justify-center gap-3 mt-4">
            <Button size="sm" variant="outline" className="border-border bg-transparent text-white/60" onClick={() => setPageAll((p) => Math.max(1, p - 1))} disabled={pageAll === 1}>← Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {pageAll}</span>
            <Button size="sm" variant="outline" className="border-border bg-transparent text-white/60" onClick={() => setPageAll((p) => p + 1)} disabled={allObras.length < 20}>Próxima →</Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Capítulos Tab ────────────────────────────────────────────────────────────
function CapitulosTab() {
  const utils = trpc.useUtils();
  const { data: pending = [] } = trpc.capitulos.pending.useQuery();
  const approve = trpc.capitulos.approve.useMutation({ onSuccess: () => { utils.capitulos.pending.invalidate(); toast.success("Capítulo atualizado!"); }, onError: (e) => toast.error(e.message) });
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Capítulos Pendentes ({pending.length})</h2>
      {pending.length === 0 ? <div className="asc-card p-8 text-center text-muted-foreground">Nenhum capítulo aguardando.</div> : pending.map((cap: any) => (
        <div key={cap.id} className="asc-card p-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white">Obra #{cap.obraId} — Cap. {cap.numero}{cap.title ? `: ${cap.title}` : ""}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tradutor ID: {cap.authorId} • {new Date(cap.createdAt).toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => approve.mutate({ id: cap.id, status: "aprovado" })} disabled={approve.isPending}><Check className="w-3.5 h-3.5 mr-1" />Aprovar</Button>
            <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent" onClick={() => approve.mutate({ id: cap.id, status: "rejeitado" })} disabled={approve.isPending}><X className="w-3.5 h-3.5 mr-1" />Rejeitar</Button>
          </div>
        </div>
      ))}
    </div>
  );
}


// ─── Gerenciar Caps Tab ───────────────────────────────────────────────────────
function GerenciarCapsTab() {
  const utils = trpc.useUtils();
  const [busca, setBusca] = useState("");
  const [obraId, setObraId] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  // Busca por slug
  const { data: obraBySlug } = trpc.obras.bySlug.useQuery(
    { slug: busca.trim() },
    { enabled: buscando && !!busca && isNaN(parseInt(busca)) }
  );

  // Resolve obraId — aceita número direto ou slug
  const obraIdResolvido = !isNaN(parseInt(busca))
    ? parseInt(busca)
    : obraBySlug?.id ?? 0;

  const { data: caps = [], isLoading, refetch } = trpc.capitulos.searchByObra.useQuery(
    { obraId: obraIdResolvido },
    { enabled: buscando && obraIdResolvido > 0 }
  );

  const deleteCap = trpc.capitulos.delete.useMutation({
    onSuccess: () => {
      utils.capitulos.searchByObra.invalidate();
      toast.success("Capítulo deletado!");
      setConfirmDelete(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function buscar() {
    if (!busca.trim()) return toast.error("Digite o slug ou ID da obra.");
    setBuscando(true);
    refetch();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Gerenciar Capítulos</h2>
      <div className="flex gap-2">
        <Input
          placeholder="Slug (ex: apocalypse-bringer) ou ID (ex: 5)"
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setBuscando(false); }}
          className="bg-secondary border-border text-white max-w-xs"
          onKeyDown={(e) => e.key === "Enter" && buscar()}
        />
        <Button onClick={buscar} className="bg-primary text-white">Buscar</Button>
      </div>
      {buscando && obraBySlug && (
        <p className="text-xs text-green-400">✅ Obra encontrada: <strong>{obraBySlug.title}</strong> (ID: {obraBySlug.id})</p>
      )}
      {buscando && !isNaN(parseInt(busca)) === false && !obraBySlug && !isLoading && (
        <p className="text-xs text-red-400">Obra não encontrada para esse slug.</p>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}

      {buscando && !isLoading && caps.length === 0 && (
        <div className="asc-card p-8 text-center text-muted-foreground">Nenhum capítulo encontrado para essa obra.</div>
      )}

      {caps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{caps.length} capítulo{caps.length !== 1 ? "s" : ""} encontrado{caps.length !== 1 ? "s" : ""}</p>
          {caps.map((cap: any) => (
            <div key={cap.id} className="asc-card p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Cap. {cap.numero}{cap.title ? ` — ${cap.title}` : ""}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ID: {cap.id} • {cap.status === "aprovado" ? "✅ Aprovado" : cap.status === "aguardando" ? "⏳ Pendente" : "❌ Rejeitado"} • {new Date(cap.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Button size="sm" variant="outline"
                className="border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent flex-shrink-0"
                onClick={() => setConfirmDelete(cap)}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />Deletar
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Deletar capítulo?</AlertDialogTitle>
            <AlertDialogDescription>
              Cap. {confirmDelete?.numero}{confirmDelete?.title ? ` — ${confirmDelete.title}` : ""} será deletado permanentemente. As imagens no R2 não serão removidas automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-white/70">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => confirmDelete && deleteCap.mutate({ id: confirmDelete.id })}>
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Usuários Tab ─────────────────────────────────────────────────────────────
const ROLE_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "admin_supremo",     label: "Admin Supremo" },
  { value: "admin_senhor",      label: "Admin Senhor"  },
  { value: "tradutor_oficial",  label: "Trad. Oficial" },
  { value: "tradutor_aprendiz", label: "Trad. Aprendiz"},
  { value: "usuario",           label: "Usuário"       },
];

function UsuariosTab({ isSupreme, currentUserId }: { isSupreme: boolean; currentUserId: number }) {
  const utils = trpc.useUtils();
  const [search, setSearch]               = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter]       = useState("todos");
  const [banTarget, setBanTarget]         = useState<any>(null);
  const [banTipo, setBanTipo]             = useState<"suave" | "total">("suave");

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as any)._t);
    (handleSearch as any)._t = setTimeout(() => setDebouncedSearch(val), 400);
  };

  const { data: allUsers = [] } = trpc.admin.users.useQuery(
    { page: 1, search: debouncedSearch || undefined, role: roleFilter !== "todos" ? roleFilter : undefined },
    { keepPreviousData: true } as any
  );
  const setRole    = trpc.admin.setRole.useMutation({ onSuccess: () => { utils.admin.users.invalidate(); toast.success("Cargo atualizado!"); }, onError: (e) => toast.error(e.message) });
  const banUserMut = trpc.admin.banUser.useMutation({ onSuccess: () => { utils.admin.users.invalidate(); toast.success("Usuário atualizado!"); setBanTarget(null); }, onError: (e) => toast.error(e.message) });

  const availableRoles = isSupreme
    ? ["usuario", "tradutor_aprendiz", "tradutor_oficial", "admin_senhor"]
    : ["usuario", "tradutor_aprendiz", "tradutor_oficial"];

  return (
    <div className="space-y-3">
      <Input value={search} onChange={(e) => handleSearch(e.target.value)} placeholder="Buscar por ID ou nome..." className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
      <div className="flex flex-wrap gap-2">
        {ROLE_FILTER_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => setRoleFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${roleFilter === opt.value ? "bg-primary border-primary text-white" : "bg-transparent border-border text-white/60 hover:text-white"}`}>
            {opt.label}
          </button>
        ))}
      </div>
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">{allUsers.length} usuário(s)</h2>
      {allUsers.map((u: any) => {
        const roleInfo        = ROLE_LABELS[u.role];
        const isSelf          = u.id === currentUserId;
        const estaBanidoSuave = u.banned && !u.bannedTotal;
        const estaBanidoTotal = u.bannedTotal;
        return (
          <div key={u.id} className="asc-card p-4 space-y-3">
            {/* Linha 1: nome + badges */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{u.displayName || u.name || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                <p className="text-xs text-muted-foreground">ID: {u.id} • 🪙 {u.moedas ?? 0}</p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`asc-badge ${roleInfo?.cls}`}>{roleInfo?.label}</span>
                {estaBanidoTotal && <span className="asc-badge asc-badge-red">🚫 Banido Total</span>}
                {estaBanidoSuave && <span className="asc-badge asc-badge-yellow">⚠️ Banido</span>}
                {isSelf && <span className="asc-badge asc-badge-blue">Você</span>}
              </div>
            </div>
            {/* Linha 2: ações */}
            {!isSelf && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
                <Select value={u.role} onValueChange={(role) => setRole.mutate({ userId: u.id, role: role as any })}>
                  <SelectTrigger className="w-36 bg-secondary border-border text-white text-sm h-8 flex-shrink-0"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border text-white">
                    {availableRoles.map((r) => <SelectItem key={r} value={r} className="text-white hover:bg-secondary">{ROLE_LABELS[r]?.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!estaBanidoSuave && !estaBanidoTotal && (
                  <Button size="sm" variant="outline" className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 text-xs h-8" onClick={() => { setBanTarget(u); setBanTipo("suave"); }}>⚠️ Banir</Button>
                )}
                {!estaBanidoTotal && isSupreme && (
                  <Button size="sm" variant="outline" className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs h-8" onClick={() => { setBanTarget(u); setBanTipo("total"); }}>🚫 Ban Total</Button>
                )}
                {(estaBanidoSuave || estaBanidoTotal) && (
                  <Button size="sm" variant="outline" className="border-green-500/40 text-green-400 hover:bg-green-500/10 text-xs h-8" onClick={() => banUserMut.mutate({ userId: u.id, banned: false, total: false })}>✅ Desbanir</Button>
                )}
              </div>
            )}
          </div>
        );
      })}
      <AlertDialog open={!!banTarget} onOpenChange={(open) => { if (!open) setBanTarget(null); }}>
        <AlertDialogContent className="bg-card border-border text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{banTipo === "total" ? "🚫 Banimento Total" : "⚠️ Banimento Suave"}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {banTipo === "total" ? `${banTarget?.displayName || banTarget?.name} ficará sem acesso a nada no site.` : `${banTarget?.displayName || banTarget?.name} poderá ler mas não interagir.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-transparent text-white/70">Cancelar</AlertDialogCancel>
            <AlertDialogAction className={banTipo === "total" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-yellow-600 hover:bg-yellow-700 text-white"} onClick={() => banUserMut.mutate({ userId: banTarget.id, banned: true, total: banTipo === "total" })}>Confirmar</AlertDialogAction>
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
    pedido_cargo_aprovado: "🎉 Aprovou pedido", pedido_cargo_rejeitado: "❌ Rejeitou pedido",
    criar_item_loja: "🛍️ Criou item na loja", toggle_item_loja: "👁️ Ativou/desativou item",
  };
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">Log de Ações ({logs.length})</h2>
      {logs.length === 0 ? <div className="asc-card p-8 text-center text-muted-foreground">Nenhuma ação registrada.</div> : (
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
          {logs.map((log: any) => (
            <div key={log.id} className="asc-card p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90">
                  {ACTION_LABELS[log.acao] ?? log.acao}
                  {log.targetType && log.targetId && <span className="text-muted-foreground ml-1">({log.targetType} #{log.targetId})</span>}
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
  const [telegramUrl, setTelegramUrl]   = useState("");
  const [emailContato, setEmailContato] = useState("");
  const [discordUrl, setDiscordUrl]     = useState("");
  const { data: telegramLink } = trpc.admin.getPublicLink.useQuery({ key: "telegram" });
  const { data: emailLink }    = trpc.admin.getPublicLink.useQuery({ key: "email_contato" });
  const { data: discordLink }  = trpc.admin.getPublicLink.useQuery({ key: "discord" });
  const setLink = trpc.admin.setPublicLink.useMutation({ onSuccess: () => toast.success("Salvo!"), onError: (e) => toast.error(e.message) });
  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Links & Contato</h2>
      <div className="asc-card p-5 space-y-6">
        <div>
          <Label className="text-white/80 mb-1.5 block">Link do Telegram</Label>
          <p className="text-xs text-muted-foreground mb-2">Enviado a novos tradutores quando aprovados.</p>
          {telegramLink && <p className="text-xs text-green-400 mb-2">Atual: {telegramLink.value}</p>}
          <div className="flex gap-2">
            <Input value={telegramUrl} onChange={(e) => setTelegramUrl(e.target.value)} placeholder="https://t.me/..." className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
            <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setLink.mutate({ key: "telegram", value: telegramUrl })} disabled={!telegramUrl.trim() || setLink.isPending}>Salvar</Button>
          </div>
        </div>
        <div>
          <Label className="text-white/80 mb-1.5 block">Email de Contato</Label>
          <p className="text-xs text-muted-foreground mb-2">Aparece no rodapé do site.</p>
          {emailLink && <p className="text-xs text-green-400 mb-2">Atual: {emailLink.value}</p>}
          <div className="flex gap-2">
            <Input value={emailContato} onChange={(e) => setEmailContato(e.target.value)} placeholder="contato@seusite.com" type="email" className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
            <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setLink.mutate({ key: "email_contato", value: emailContato })} disabled={!emailContato.trim() || setLink.isPending}>Salvar</Button>
          </div>
        </div>
        <div>
          <Label className="text-white/80 mb-1.5 block">Link do Discord</Label>
          <p className="text-xs text-muted-foreground mb-2">Aparece no rodapé do site.</p>
          {discordLink && <p className="text-xs text-green-400 mb-2">Atual: {discordLink.value}</p>}
          <div className="flex gap-2">
            <Input value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} placeholder="https://discord.gg/..." className="bg-secondary border-border text-white placeholder:text-muted-foreground" />
            <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setLink.mutate({ key: "discord", value: discordUrl })} disabled={!discordUrl.trim() || setLink.isPending}>Salvar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Loja Tab Wrapper (proteção contra crash) ─────────────────────────────────
function LojaTabWrapper() {
  const [crashed, setCrashed] = useState(false);
  if (crashed) {
    return (
      <div className="asc-card p-8 text-center space-y-3">
        <p className="text-2xl">⚠️</p>
        <p className="text-yellow-400 font-bold">Tabelas da loja não encontradas</p>
        <p className="text-muted-foreground text-sm">
          Rode as migrations SQL no DBeaver antes de usar esta aba.
        </p>
        <Button variant="outline" className="border-border text-white/60 mt-2" onClick={() => setCrashed(false)}>
          Tentar novamente
        </Button>
      </div>
    );
  }
  return <LojaTab onError={() => setCrashed(true)} />;
}

// ─── Loja Tab ─────────────────────────────────────────────────────────────────
const TIPO_LABELS: Record<string, string> = {
  moldura: "🖼️ Moldura", banner: "🎬 Banner", cor_comentario: "🎨 Cor Comentário", tag: "🏷️ Tag",
};
const RARIDADE_LABELS: Record<string, { label: string; cls: string }> = {
  comum:    { label: "Comum",    cls: "text-white/60"    },
  raro:     { label: "Raro",     cls: "text-blue-400"    },
  epico:    { label: "Épico",    cls: "text-purple-400"  },
  lendario: { label: "Lendário", cls: "text-yellow-400"  },
};
const CARGO_OPTIONS = [
  { value: "nenhum", label: "Nenhum (item pago)" },
  { value: "tradutor_aprendiz", label: "Tradutor Aprendiz" },
  { value: "tradutor_oficial",  label: "Tradutor Oficial"  },
  { value: "admin_senhor",      label: "Admin Senhor"      },
];

function LojaTab({ onError }: { onError?: () => void }) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);

  // Form de cadastro
  const [nome, setNome]               = useState("");
  const [descricao, setDescricao]     = useState("");
  const [tipo, setTipo]               = useState<string>("moldura");
  const [raridade, setRaridade]       = useState<string>("comum");
  const [preco, setPreco]             = useState<string>("20");
  const [cargoMinimo, setCargoMinimo] = useState<string>("");
  const [gratuito, setGratuito]       = useState(false);
  const [mediaFile, setMediaFile]     = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [salvando, setSalvando]       = useState(false);
  const [filtroTipo, setFiltroTipo]   = useState<string>("todos");

  const { data: itens = [], isError: itensError } = trpc.loja.listItens.useQuery(
    { tipo: filtroTipo !== "todos" ? filtroTipo : undefined },
    { retry: false, onError: () => onError?.() }
  );
  const criarItem    = trpc.loja.criarItem.useMutation({ onSuccess: () => { utils.loja.listItens.invalidate(); toast.success("Item criado!"); resetForm(); }, onError: (e) => toast.error(e.message) });
  const toggleItem   = trpc.loja.toggleItem.useMutation({ onSuccess: () => { utils.loja.listItens.invalidate(); toast.success("Item atualizado!"); }, onError: (e) => toast.error(e.message) });

  function resetForm() {
    setNome(""); setDescricao(""); setTipo("moldura"); setRaridade("comum");
    setPreco("20"); setCargoMinimo(""); setGratuito(false);
    setMediaFile(null); setMediaPreview(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) { toast.error("Use imagem (gif/webp/png) ou vídeo (mp4)."); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Máximo 20MB."); return; }
    setMediaFile(file);
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setMediaPreview("video"); // placeholder
    }
  }

  async function handleSalvar() {
    if (!nome.trim()) return toast.error("Nome obrigatório.");
    if (!mediaFile) return toast.error("Selecione um arquivo de mídia.");
    setSalvando(true);
    try {
      // Upload do arquivo via endpoint existente
      const formData = new FormData();
      formData.append("file", mediaFile);
      formData.append("tipo", tipo);
      const res = await fetch("/api/upload/loja", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Erro no upload.");
      const { url, key } = await res.json();
      await criarItem.mutateAsync({
        nome: nome.trim(), descricao: descricao.trim() || undefined,
        tipo: tipo as any, raridade: raridade as any,
        preco: gratuito ? 0 : parseInt(preco) || 0,
        mediaUrl: url, mediaKey: key,
        gratuito, cargoMinimo: cargoMinimo || undefined,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar.");
    } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-6">
      {/* Formulário de cadastro */}
      <div className="asc-card p-5 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2"><Plus className="w-4 h-4 text-primary" />Cadastrar Novo Item</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-white/60 text-xs mb-1 block">Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Moldura Dragão" maxLength={100} className="bg-secondary border-border text-white" />
          </div>
          <div>
            <Label className="text-white/60 text-xs mb-1 block">Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="bg-secondary border-border text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                {Object.entries(TIPO_LABELS).map(([v, l]) => <SelectItem key={v} value={v} className="text-white">{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-white/60 text-xs mb-1 block">Raridade</Label>
            <Select value={raridade} onValueChange={setRaridade}>
              <SelectTrigger className="bg-secondary border-border text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                {Object.entries(RARIDADE_LABELS).map(([v, r]) => <SelectItem key={v} value={v} className={`${r.cls}`}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-white/60 text-xs mb-1 block">Conceder automaticamente ao cargo</Label>
            <Select value={cargoMinimo || "nenhum"} onValueChange={(v) => { const val = v === "nenhum" ? "" : v; setCargoMinimo(val); if (val) setGratuito(true); }}>
              <SelectTrigger className="bg-secondary border-border text-white"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                {CARGO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-white">{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-white/60 text-xs mb-1 block">Descrição</Label>
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição curta do item" maxLength={200} className="bg-secondary border-border text-white" />
        </div>

        {/* Preço */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="gratuito" checked={gratuito} onChange={(e) => setGratuito(e.target.checked)} className="w-4 h-4 accent-primary" />
            <Label htmlFor="gratuito" className="text-white/70 text-sm cursor-pointer">Gratuito (por cargo)</Label>
          </div>
          {!gratuito && (
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-sm">🪙</span>
              <Input value={preco} onChange={(e) => setPreco(e.target.value)} type="number" min={1} max={9999} className="bg-secondary border-border text-white w-24" />
              <span className="text-xs text-muted-foreground">moedas</span>
            </div>
          )}
        </div>

        {/* Upload de mídia */}
        <div>
          <Label className="text-white/60 text-xs mb-1 block">Arquivo de mídia * (gif, webp, mp4 — máx. 20MB)</Label>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
          >
            {mediaPreview && mediaPreview !== "video" ? (
              <img src={mediaPreview} alt="preview" className="max-h-32 mx-auto rounded-lg object-contain" />
            ) : mediaPreview === "video" && mediaFile ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">🎬</span>
                <p className="text-sm text-white/70">{mediaFile.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="w-8 h-8" />
                <p className="text-sm">Clique para selecionar o arquivo</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/gif,image/webp,image/png,video/mp4" className="hidden" onChange={handleFileChange} />
        </div>

        <div className="flex gap-3">
          <Button className="bg-primary hover:bg-primary/90 text-white" onClick={handleSalvar} disabled={salvando || !nome || !mediaFile}>
            {salvando ? "Salvando..." : "Criar Item"}
          </Button>
          <Button variant="ghost" className="text-white/50" onClick={resetForm}>Limpar</Button>
        </div>
      </div>

      {/* Lista de itens */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Itens na Loja ({itens.length})</h2>
          <div className="flex gap-1.5 flex-wrap">
            {["todos", ...Object.keys(TIPO_LABELS)].map((t) => (
              <button key={t} onClick={() => setFiltroTipo(t)}
                className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${filtroTipo === t ? "bg-primary border-primary text-white" : "border-border text-white/50 hover:text-white"}`}>
                {t === "todos" ? "Todos" : TIPO_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {itensError ? (
          <div className="asc-card p-8 text-center">
            <p className="text-yellow-400 font-bold text-sm mb-1">⚠️ Tabelas da loja não encontradas</p>
            <p className="text-muted-foreground text-xs">Rode as migrations SQL no DBeaver primeiro.</p>
          </div>
        ) : itens.length === 0 ? (
          <div className="asc-card p-8 text-center text-muted-foreground">Nenhum item cadastrado ainda.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {itens.map((item: any) => {
              const rar = RARIDADE_LABELS[item.raridade];
              const isVideo = item.mediaUrl?.match(/\.(mp4|webm)$/i);
              return (
                <div key={item.id} className={`asc-card p-4 flex flex-col gap-3 ${!item.ativo ? "opacity-50" : ""}`}>
                  {/* Preview da mídia */}
                  <div className="w-full h-28 rounded-lg bg-black/30 flex items-center justify-center overflow-hidden">
                    {isVideo ? (
                      <video src={item.mediaUrl} className="h-full object-contain" autoPlay muted loop playsInline />
                    ) : (
                      <img src={item.mediaUrl} alt={item.nome} className="h-full object-contain" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-sm font-bold text-white">{item.nome}</p>
                      <span className={`text-[10px] font-bold ${rar?.cls}`}>{rar?.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{TIPO_LABELS[item.tipo]}</p>
                    {item.cargoMinimo && <p className="text-xs text-primary mt-0.5">🎁 Cargo: {item.cargoMinimo}</p>}
                    <p className="text-xs text-yellow-400 mt-0.5">{item.gratuito ? "Gratuito" : `🪙 ${item.preco} moedas`}</p>
                    {!item.ativo && <p className="text-[10px] text-red-400 mt-0.5 font-bold">⛔ Desativado (item raro)</p>}
                  </div>
                  <Button
                    size="sm" variant="outline"
                    className={item.ativo ? "border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs" : "border-green-500/40 text-green-400 hover:bg-green-500/10 text-xs"}
                    onClick={() => toggleItem.mutate({ id: item.id, ativo: !item.ativo })}
                  >
                    {item.ativo ? <><EyeOff className="w-3 h-3 mr-1" />Desativar (tornar raro)</> : <><Eye className="w-3 h-3 mr-1" />Reativar</>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


