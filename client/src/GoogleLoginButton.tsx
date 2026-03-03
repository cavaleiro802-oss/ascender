import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

declare const google: any;

export default function GoogleLoginButton() {
  const { loginWithGoogle } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.google || !btnRef.current) return;

    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response: any) => {
        await loginWithGoogle(response.credential);
      },
    });

    google.accounts.id.renderButton(btnRef.current, {
      theme: "filled_black",
      size: "medium",
      text: "signin_with",
      shape: "pill",
    });
  }, []);

  return <div ref={btnRef} />;
}
