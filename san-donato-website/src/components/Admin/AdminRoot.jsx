import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "../../context/AuthProvider";
import { useAuth } from "../../context/auth";
import AdminLayout from "./AdminLayout";
import LoginPage from "./LoginPage";
import RegistrazionePage from "./RegistrazionePage";
import PostsListPage from "./PostsListPage";
import EventiListPage from "./EventiListPage";

// L'editor delle notizie porta con sé TipTap: si carica solo quando si apre
// davvero una notizia, non all'ingresso nell'area riservata.
const PostEditorPage = lazy(() => import("./PostEditorPage"));
const EventoEditorPage = lazy(() => import("./EventoEditorPage"));
const PersonePage = lazy(() => import("./PersonePage"));
const IscrizioniPage = lazy(() => import("./IscrizioniPage"));
const CambioPasswordPage = lazy(() => import("./CambioPasswordPage"));

function Attesa({ cosa }) {
  return (
    <div className="adm-loading">
      <div className="adm-spinner" />
      <p>Apertura {cosa}…</p>
    </div>
  );
}

/**
 * Dove si atterra entrando.
 *
 * Non è uguale per tutti: un allenatore non gestisce notizie, e mandarlo su
 * un elenco che gli risponderebbe "non hai i permessi" sarebbe un benvenuto
 * bizzarro. Ognuno entra dalla porta che gli serve.
 */
function Ingresso() {
  const { user } = useAuth();
  const capacita = user?.capabilities ?? [];

  if (capacita.includes("notizie.leggi_bozze")) return <PostsListPage />;
  if (capacita.includes("eventi.gestisci_proprie")) return <Navigate to="/admin/eventi" replace />;
  if (capacita.includes("iscritti.leggi")) return <Navigate to="/admin/iscrizioni" replace />;

  // Un atleta non ha sezioni da amministrare: il suo posto è il
  // calendario della squadra, che sta sul sito pubblico.
  return (
    <div className="adm-empty">
      <p>
        Il tuo account è attivo, ma non hai sezioni da gestire.
        Il calendario della tua squadra lo trovi sul sito.
      </p>
      <a href="/calendario" className="adm-btn adm-btn-primary">Vai al calendario</a>
    </div>
  );
}

/**
 * Radice dell'area riservata, montata su due percorsi:
 *
 *   /login     la schermata di accesso
 *   /admin/*   il pannello vero e proprio
 *
 * Entrambi passano da qui perché condividono lo stato della sessione, e
 * perché così autenticazione e chiamate di scrittura restano in un bundle
 * unico: chi visita il sito pubblico non ne scarica una riga.
 */
export default function AdminRoot({ section }) {
  if (section === "login") {
    return (
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );
  }

  if (section === "registrazione") {
    return (
      <AuthProvider>
        <RegistrazionePage />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Ingresso />} />

          {/* Notizie */}
          <Route
            path="nuova"
            element={<Suspense fallback={<Attesa cosa="dell'editor" />}><PostEditorPage /></Suspense>}
          />
          <Route
            path="modifica/:id"
            element={<Suspense fallback={<Attesa cosa="dell'editor" />}><PostEditorPage /></Suspense>}
          />

          {/* Eventi */}
          <Route path="eventi" element={<EventiListPage />} />
          <Route
            path="eventi/nuovo"
            element={<Suspense fallback={<Attesa cosa="dell'evento" />}><EventoEditorPage /></Suspense>}
          />
          <Route
            path="eventi/:id"
            element={<Suspense fallback={<Attesa cosa="dell'evento" />}><EventoEditorPage /></Suspense>}
          />

          {/* Richieste di appartenenza */}
          <Route
            path="iscrizioni"
            element={<Suspense fallback={<Attesa cosa="delle richieste" />}><IscrizioniPage /></Suspense>}
          />

          {/* Cambio password volontario: quello obbligatorio lo impone
              AdminLayout prima di mostrare qualunque altra cosa. */}
          <Route
            path="password"
            element={<Suspense fallback={<Attesa cosa="della schermata" />}><CambioPasswordPage /></Suspense>}
          />

          {/* Persone */}
          <Route
            path="persone"
            element={<Suspense fallback={<Attesa cosa="dell'elenco" />}><PersonePage /></Suspense>}
          />

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
