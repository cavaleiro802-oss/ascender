import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

declare global {
  interface Window {
    google?: any;
  }
}

function loadGoogleGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Já carregado
    if (window.google?.accounts?.id) return resolve();

    // Já existe tag, só aguarda carregar
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar GIS")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar GIS"));
    document.head.appendChild(script);
  });
}

export default function GoogleLoginButton() {
  const { loginWithGoogle } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    loadGoogleGsiScript()
      .then(() => {
        if (alive) setReady(true);
      })
      .catch((e) => {
        console.error("[GoogleLoginButton]", e);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (initializedRef.current) return;
    if (!btnRef.current) return;
    if (!window.google?.accounts?.id) return;

    initializedRef.current = true;

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response: { credential?: string }) => {
        if (!response?.credential) return;
        await loginWithGoogle(response.credential);
      },
    });

    window.google.accounts.id.renderButton(btnRef.current, {
      theme: "filled_black",
      size: "medium",
      text: "signin_with",
      shape: "pill",
    });

    return () => {
      if (btnRef.current) btnRef.current.innerHTML = "";
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {}
    };
  }, [ready, loginWithGoogle]);

  return <div ref={btnRef} />;
}
