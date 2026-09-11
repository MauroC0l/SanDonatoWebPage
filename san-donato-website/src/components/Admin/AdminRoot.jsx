import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "../../context/AuthProvider";
import AdminLayout from "./AdminLayout";
import LoginPage from "./LoginPage";
import PostsListPage from "./PostsListPage";

// L'editor porta con sé TipTap: si carica solo quando si apre davvero
// una notizia, non all'ingresso nell'area riservata.
const PostEditorPage = lazy(() => import("./PostEditorPage"));

function EditorFallback() {
  return (
    <div className="adm-loading">
      <div className="adm-spinner" />
      <p>Apertura dell&apos;editor…</p>
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

  return (
    <AuthProvider>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<PostsListPage />} />
          <Route
            path="nuova"
            element={<Suspense fallback={<EditorFallback />}><PostEditorPage /></Suspense>}
          />
          <Route
            path="modifica/:id"
            element={<Suspense fallback={<EditorFallback />}><PostEditorPage /></Suspense>}
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
