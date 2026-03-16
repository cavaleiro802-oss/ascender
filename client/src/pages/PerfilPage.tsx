import { cfAvatar } from "@/lib/imageUtils";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import Topbar from "@/components/Topbar";
import { useState, useRef } from "react";
import { User, Camera, ShoppingBag, Coins, X } from "lucide-react";
import { uploadAvatar } from "@/lib/upload";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  usuario:           { label: "Usuário",        color: "text-blue-400"   },
  tradutor_aprendiz: { label: "Trad. Aprendiz", color: "text-yellow-400" },
  tradutor_oficial:  { label: "Trad. Oficial",  color: "text-green-400"  },
  criador:           { label: "Criador",         color: "text-purple-400" },
  admin_senhor:      { label: "Admin",           color: "text-red-400"    },
  admin_supremo:     { label: "Admin Supremo",   color: "text-primary"    },
};

const TIPO_LABELS: Record<string, string> = {
  moldura: "Moldura", banner: "Banner", cor_comentario: "Cor Comentário", tag: "Tag",
};

export default function PerfilPage() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate]  = useLocation();
  const fileRef       = useRef<HTMLInputElement>(null);
  const utils         = trpc.useUtils();

  const [displayName,    setDisplayName]    = useState(user?.displayName || "");
  const [avatarPreview,  setAvatarPreview]  = useState(user?.avatarUrl || "");
  const [avatarFile,     setAvatarFile]     = useState<File | null>(null);
  const [isEditing,      setIsEditing]      = useState(false);
  const [isSaving,       setIsSaving]       = useState(false);
  const [uploadingAvatar,setUploadingAvatar]= useState(false);

  const updateProfile = trpc.auth.updateProfile.useMutation();
  const desequipar    = trpc.loja.desequipar.useMutation({
    onSuccess: () => { utils.auth.me.invalidate(); utils.loja.meusItens.invalidate(); toast.success("Item removido!"); },
    onError:   (e) => toast.error(e.message),
  });
  const { data: meusItens = [] } = trpc.loja.meusItens.useQuery(undefined, { enabled: isAuthenticated });
  const { data: moedas = 0 }     = trpc.loja.minhasMoedas.useQuery(undefined, { enabled: isAuthenticated });

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground mb-4">Você precisa estar logado.</p>
          <Button onClick={() => navigate("/")} className="bg-primary hover:bg-primary/90">Voltar</Button>
        </div>
      </div>
    );
  }

  const roleInfo      = ROLE_LABELS[user.role ?? "usuario"];
  const cosmeticos    = (() => { try { return JSON.parse((user as any).cosmeticos ?? "{}"); } catch { return {}; } })();
  const molduraUrl    = cosmeticos?.moldura?.mediaUrl;
  const itensEquipados = (meusItens as any[]).filter((i) => i.equipado);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5MB."); return; }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      let finalAvatarUrl = avatarPreview;
      if (avatarFile) {
        setUploadingAvatar(true);
        const result = await uploadAvatar(avatarFile);
        finalAvatarUrl = result.publicUrl;
        setUploadingAvatar(false);
      }
      await updateProfile.mutateAsync({ displayName: displayName.trim() || undefined, avatarUrl: finalAvatarUrl || "" });
      utils.auth.me.invalidate();
      setAvatarFile(null); setIsEditing(false);
      toast.success("Perfil atualizado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally { setIsSaving(false); setUploadingAvatar(false); }
  }

  function handleCancel() {
    setDisplayName(user?.displayName || "");
    setAvatarPreview(user?.avatarUrl || "");
    setAvatarFile(null); setIsEditing(false);
  }

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-8 max-w-2xl space-y-4">

        {/* Card principal */}
        <div className="asc-card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black text-white">Meu Perfil</h1>
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5">
              <span className="text-yellow-400">🪙</span>
              <span className="text-yellow-400 font-black">{moedas}</span>
              <span className="text-yellow-400/50 text-xs">moedas</span>
            </div>
          </div>

          {/* Avatar com moldura */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group">
              <div className="relative w-24 h-24">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border shadow-lg bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center">
                  {avatarPreview
                    ? <img src={cfAvatar(avatarPreview)} alt="Avatar" className="w-full h-full object-cover" />
                    : <User className="w-12 h-12 text-white" />
                  }
                </div>
                {molduraUrl && (
                  <img src={molduraUrl} alt="moldura" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 2 }} />
                )}
                {isEditing && (
                  <button onClick={() => fileRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Camera className="w-6 h-6 text-white" />
                  </button>
                )}
              </div>
            </div>
            {isEditing && (
              <button onClick={() => fileRef.current?.click()} className="mt-3 text-xs text-primary flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" /> Alterar foto
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            <div className="mt-3 text-center">
              <p className="text-white font-bold text-lg">{user.displayName || user.name || "Sem nome"}</p>
              <p className={`text-sm font-semibold ${roleInfo.color}`}>{roleInfo.label}</p>
            </div>
          </div>

          {/* Infos */}
          <div className="space-y-3">
            {[
              { label: "Email",        value: user.email || "—" },
              { label: "ID",           value: `#${user.id}` },
              { label: "Membro desde", value: new Date(user.createdAt).toLocaleDateString("pt-BR") },
              { label: "Último acesso",value: new Date(user.lastSignedIn).toLocaleDateString("pt-BR") },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center py-2.5 border-b border-border/50">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                <span className="text-white text-sm font-medium">{item.value}</span>
              </div>
            ))}
            <div className="py-2.5">
              <label className="text-sm text-muted-foreground block mb-2">Nome de Exibição</label>
              {isEditing
                ? <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} className="bg-secondary border-border text-white" />
                : <p className="text-white font-medium">{user.displayName || user.name || "Não definido"}</p>
              }
            </div>
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="border-border text-white">Cancelar</Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white min-w-[120px]">
                  {uploadingAvatar ? "Enviando..." : isSaving ? "Salvando..." : "Salvar"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} className="bg-primary hover:bg-primary/90 text-white">Editar Perfil</Button>
            )}
          </div>
        </div>

        {/* Cosméticos equipados */}
        <div className="asc-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-white">Cosméticos Equipados</h2>
            <Button size="sm" onClick={() => navigate("/loja")} className="bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" /> Loja
            </Button>
          </div>

          {itensEquipados.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/30 text-sm mb-3">Nenhum cosmético equipado.</p>
              <Button size="sm" variant="outline" onClick={() => navigate("/loja")} className="border-border text-white/50 hover:text-white">
                Ver Loja
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {itensEquipados.map((item: any) => (
                <div key={item.id} className="relative rounded-xl overflow-hidden border border-white/10 bg-black/30 group">
                  <div className="aspect-square">
                    {item.lojaItem?.mediaUrl?.match(/\.(mp4|webm)$/i)
                      ? <video src={item.lojaItem.mediaUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                      : <img src={item.lojaItem?.mediaUrl} alt={item.lojaItem?.nome} className="w-full h-full object-cover" />
                    }
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-bold text-white truncate">{item.lojaItem?.nome ?? "Item"}</p>
                    <p className="text-[10px] text-white/40">{TIPO_LABELS[item.lojaItem?.tipo] ?? ""}</p>
                  </div>
                  <button
                    onClick={() => desequipar.mutate({ itemId: item.itemId })}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30 hover:border-red-500/40">
                    <X className="w-3 h-3 text-white/70" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>



      </main>
    </div>
  );
}
