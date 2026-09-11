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
 * Radice dell'area riservata.
 *
 * Autenticazione e chiamate di scrittura vivono tutte qui dentro: chi visita
 * il sito pubblico non scarica una riga di questo codice.
 */
export default function AdminRoot() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="accedi" element={<LoginPage />} />
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
