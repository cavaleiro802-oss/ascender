
import { useEffect, useRef, useState } from "react";  
import { useLocation } from "wouter";  
import { useAuth } from "@/hooks/useAuth";  
  
declare global {  
  interface Window { google?: any; }  
}  
  
export default function LoginPage() {  
  const { isAuthenticated, loginWithGoogle } = useAuth();  
  const [, navigate] = useLocation();  
  const btnRef = useRef<HTMLDivElement>(null);  
  const initializedRef = useRef(false);  
  const [ready, setReady] = useState(false);  
  
  // Redireciona se já estiver logado  
  useEffect(() => {  
    if (isAuthenticated) navigate("/");  
  }, [isAuthenticated, navigate]);  
  
  // Carrega script do Google  
  useEffect(() => {  
    function tryInit() {  
      if (window.google?.accounts?.id) {  
        setReady(true);  
      } else {  
        setTimeout(tryInit, 100);  
      }  
    }  
    tryInit();  
  }, []);  
  
  // Inicializa botão  
  useEffect(() => {  
    if (!ready || initializedRef.current || !btnRef.current) return;  
    initializedRef.current = true;  
 window.google.accounts.id.initialize({  
  client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,  
  callback: async (response: { credential?: string }) => {  
    if (!response?.credential) return;  
    await loginWithGoogle(response.credential);  
    navigate("/");  
  },  
  ux_mode: "popup",  
  auto_select: false,  
});  
  
window.google.accounts.id.renderButton(btnRef.current, {  
  theme: "filled_black",  
  size: "large",  
  text: "signin_with",  
  shape: "pill",  
});
  }, [ready]);  
  
  return (  
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8">  
      <div className="flex flex-col items-center gap-4">  
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none">  
          <path d="M12 3 L22 21 H2 L12 3 Z" stroke="rgba(255,27,27,.95)" strokeWidth="1.8" />  
          <path d="M12 7.2 L18.6 20 H5.4 L12 7.2 Z" stroke="rgba(255,27,27,.35)" strokeWidth="1.2" />  
          <path d="M12 3 L22 21" stroke="rgba(255,255,255,.12)" strokeWidth="1" />  
          <path d="M12 3 L2 21" stroke="rgba(255,255,255,.10)" strokeWidth="1" />  
        </svg>  
        <span className="font-black text-3xl tracking-widest uppercase text-white">ASCENDER</span>  
        <p className="text-white/40 text-sm">Sua plataforma de traduções</p>  
      </div>  
  
      <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-4 w-80">  
        <p className="text-white/70 text-sm text-center">Entre com sua conta Google para continuar</p>  
        <div ref={btnRef} />  
        {!ready && <p className="text-white/30 text-xs">Carregando...</p>}  
      </div>  
    </div>  
  );  
}
