import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import Topbar from "@/components/Topbar";
import { useState, useRef } from "react";
import { User, Camera, ShoppingBag } from "lucide-react";
import { uploadAvatar } from "@/lib/upload";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  usuario:           { label: "Usuário",          color: "text-blue-400" },
  tradutor_aprendiz: { label: "Trad. Aprendiz",   color: "text-yellow-400" },
  tradutor_oficial:  { label: "Trad. Oficial",    color: "text-green-400" },
  criador:           { label: "Criador",           color: "text-purple-400" },
  admin_senhor:      { label: "Admin",             color: "text-red-400" },
  admin_supremo:     { label: "Admin Supremo",     color: "text-primary" },
};

export default function PerfilPage() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const updateProfile = trpc.auth.updateProfile.useMutation();
  const utils = trpc.useUtils();

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground mb-4">Você precisa estar logado para acessar esta página.</p>
          <Button onClick={() => navigate("/")} className="bg-primary hover:bg-primary/90">Voltar ao Início</Button>
        </div>
      </div>
    );
  }

  const roleInfo = ROLE_LABELS[user.role ?? "usuario"];

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }
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

      await updateProfile.mutateAsync({
        displayName: displayName.trim() || undefined,
        avatarUrl: finalAvatarUrl || "",
      });

      utils.auth.me.invalidate();
      setAvatarFile(null);
      setIsEditing(false);
      toast.success("Perfil atualizado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setIsSaving(false);
      setUploadingAvatar(false);
    }
  }

  function handleCancel() {
    setDisplayName(user?.displayName || "");
    setAvatarPreview(user?.avatarUrl || "");
    setAvatarFile(null);
    setIsEditing(false);
  }

  const savingText = uploadingAvatar ? "Enviando foto..." : isSaving ? "Salvando..." : "Salvar";

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-8 max-w-2xl">
        <div className="asc-card p-6 sm:p-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-black text-white">Meu Perfil</h1>
            {/* Botão loja — caminho pavimentado para cosméticos */}
            <Button
              variant="outline"
              size="sm"
              className="border-border text-white/50 hover:text-white gap-2 opacity-50 cursor-not-allowed"
              disabled
              title="Em breve"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Loja</span>
              <span className="text-[10px] text-primary ml-1">Em breve</span>
            </Button>
          </div>

          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/40 flex items-center justify-center overflow-hidden border-2 border-border shadow-lg shadow-primary/10">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-white" />
                )}
              </div>
              {isEditing && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
              )}
            </div>

            {isEditing && (
              <button
                onClick={() => fileRef.current?.click()}
                className="mt-3 text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Alterar foto
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />

            <div className="mt-3 text-center">
              <p className="text-white font-bold text-lg">{user.displayName || user.name || "Sem nome"}</p>
              <p className={`text-sm font-semibold ${roleInfo.color}`}>{roleInfo.label}</p>
            </div>
          </div>

          {/* Infos */}
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-white text-sm font-medium">{user.email || "—"}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border/50">
              <span className="text-sm text-muted-foreground">ID</span>
              <span className="text-white/60 text-sm font-mono">#{user.id}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Membro desde</span>
              <span className="text-white text-sm">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Último acesso</span>
              <span className="text-white text-sm">{new Date(user.lastSignedIn).toLocaleDateString("pt-BR")}</span>
            </div>

            {/* Nome de exibição */}
            <div className="py-3">
              <label className="text-sm text-muted-foreground block mb-2">Nome de Exibição</label>
              {isEditing ? (
                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                  className="bg-secondary border-border text-white"
                />
              ) : (
                <p className="text-white font-medium">{user.displayName || user.name || "Não definido"}</p>
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="mt-8 flex gap-3 justify-end">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="border-border text-white">
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-primary/90 text-white min-w-[120px]">
                  {savingText}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} className="bg-primary hover:bg-primary/90 text-white">
                Editar Perfil
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
