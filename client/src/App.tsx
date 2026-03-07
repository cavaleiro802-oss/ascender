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
import LojaPage from "@/pages/LojaPage";
import NotFound from "@/pages/NotFound";
import Footer from "@/components/Footer";
import LoginPage from "@/pages/LoginPage";
import CarrinhoFlutuante from "@/components/CarrinhoFlutuante";

export default function App() {
  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={LoginPage} />
        <Route path="/obra/:id/novo-capitulo" component={NovoCapituloPage} />
        <Route path="/obra/:obraId/capitulo/:capId" component={CapituloPage} />
        <Route path="/obra/:id" component={ObraPage} />
        <Route path="/nova-obra" component={NovaObraPage} />
        <Route path="/biblioteca" component={BibliotecaPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/admin/:tab" component={AdminPage} />
        <Route path="/perfil" component={PerfilPage} />
        <Route path="/loja" component={LojaPage} />
        <Route component={NotFound} />
      </Switch>
      <Footer />
      <CarrinhoFlutuante />
      <Toaster theme="dark" position="bottom-right" richColors />
    </>
  );
}
