import { Switch, Route } from "wouter";
import { Toaster } from "sonner";
import Home from "@/pages/Home";
import ObraPage from "@/pages/ObraPage";
import CapituloPage from "@/pages/CapituloPage";
import NovaObraPage from "@/pages/NovaObraPage";
import NovoCapituloPage from "@/pages/NovoCapituloPage";
import BibliotecaPage from "@/pages/BibliotecaPage";
import AdminPage from "@/pages/AdminPage";
import PerfilPage from "@/pages/PerfilPage";
import NotFound from "@/pages/NotFound";
import Footer from "@/components/Footer";

export default function App() {
  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/obra/:id" component={ObraPage} />
        <Route path="/obra/:obraId/capitulo/:capId" component={CapituloPage} />
        <Route path="/nova-obra" component={NovaObraPage} />
        <Route path="/obra/:id/novo-capitulo" component={NovoCapituloPage} />
        <Route path="/biblioteca" component={BibliotecaPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/admin/:tab" component={AdminPage} />
        <Route path="/perfil" component={PerfilPage} />
        <Route component={NotFound} />
      </Switch>
      <Footer />
      <Toaster theme="dark" position="bottom-right" richColors />
    </>
  );
}
