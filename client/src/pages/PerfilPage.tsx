import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import Topbar from "@/components/Topbar";
import AscenderLoader from "@/components/AscenderLoader";
import { useState } from "react";
import { User, Upload } from "lucide-react";

export default function PerfilPage() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateUserMutation = trpc.auth.updateProfile.useMutation();

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground mb-4">Você precisa estar logado para acessar esta página.</p>
          <Button onClick={() => navigate("/")} className="bg-primary hover:bg-primary/90">
            Voltar ao Início
          </Button>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserMutation.mutateAsync({
        displayName: displayName || user.name || "",
        avatarUrl: avatarUrl || "",
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(user?.displayName || "");
    setAvatarUrl(user?.avatarUrl || "");
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen">
      <Topbar />

      <main className="container py-8 max-w-2xl">
        <div className="asc-card p-8">
          <h1 className="text-3xl font-black text-white mb-8">Meu Perfil</h1>

          {/* Avatar Section */}
          <div className="mb-8 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center mb-4 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-white" />
              )}
            </div>
            {isEditing && (
              <div className="w-full max-w-md">
                <label className="text-sm text-muted-foreground mb-2 block">URL da Foto</label>
                <Input
                  type="url"
                  placeholder="https://exemplo.com/foto.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="space-y-6">
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <p className="text-white font-medium">{user.email || "Não informado"}</p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Método de Login</label>
              <p className="text-white font-medium">{user.loginMethod || "—"}</p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Cargo</label>
              <p className="text-white font-medium capitalize">{user.role || "usuário"}</p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Nome de Exibição</label>
              {isEditing ? (
                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-background border-border"
                />
              ) : (
                <p className="text-white font-medium">{displayName || user.name || "Não definido"}</p>
              )}
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Membro desde</label>
              <p className="text-white font-medium">
                {new Date(user.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Último acesso</label>
              <p className="text-white font-medium">
                {new Date(user.lastSignedIn).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-3 justify-end">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="border-border"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSaving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                className="bg-primary hover:bg-primary/90"
              >
                Editar Perfil
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
