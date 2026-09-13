import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Outlet, useLocation } from "react-router-dom";
import MyNavbar from "./components/AllPages/MyNavbar";
import Hero from "./components/AllPages/Hero";
import TopHeader from "./components/AllPages/TopHeader";
import HomePage from "./components/Home/HomePage";
import { usePublishedHeight } from "./hooks/usePublishedHeight";

// La home resta nel bundle principale: è la pagina d'ingresso.
// Tutte le altre vengono scaricate solo quando servono davvero.
const News = lazy(() => import("./components/News/NewsPage"));
const NewsDetailPage = lazy(() => import("./components/News/NewsDetail"));
const ChiSiamoPage = lazy(() => import("./components/ChiSiamoPage"));
const SubscriptionPage = lazy(() => import("./components/SubscriptionPage"));
const CalendarPage = lazy(() => import("./components/CalendarPage"));
const ContactPage = lazy(() => import("./components/Contatti"));
const PrivacyPage = lazy(() => import("./components/PrivacyPage"));
const TutelaMinoriPage = lazy(() => import("./components/TutelaMinoriPage"));
const ContributiPage = lazy(() => import("./components/ContributiPage"));
const CinquePerMillePage = lazy(() => import("./components/CinquePerMillePage"));
const SponsorPage = lazy(() => import("./components/SponsorPage"));
const SportPage = lazy(() => import("./components/SportPage"));
const GalleriaPage = lazy(() => import("./components/Galleria/GalleriaPage"));
const NotFoundPage = lazy(() => import("./components/NotFoundPage"));

// Area riservata: nessun visitatore ne scarica una riga
const AdminRoot = lazy(() => import("./components/Admin/AdminRoot"));

// Cambiando pagina si riparte dall'alto, non dallo scroll di quella precedente
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

function RouteFallback() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <div className="route-loading-spinner"></div>
      <span>Caricamento…</span>
    </div>
  );
}

/**
 * Cornice del sito pubblico: header, hero, navbar e footer.
 * L'area riservata non la usa, per non farsi confondere con il sito.
 */
function PublicLayout() {
  // L'altezza reale dell'intestazione viene pubblicata come variabile CSS:
  // la prima sezione della home la usa per arrivare esattamente a fondo schermo.
  const headerRef = usePublishedHeight("--site-header-h");

  return (
    <div className="page-wrapper">
      <div className="site-header-stack" ref={headerRef}>
        <TopHeader />
        <Hero />
        <MyNavbar />
      </div>

      <main className="flex-grow w-full px-0">
        <Outlet />
      </main>

      <footer className="bg-gray-900 text-white py-6 text-center w-full">
        <div className="max-w-screen-xl mx-auto px-4">
          © Polisportiva San Donato — Tutti i diritti riservati
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />

      <Suspense fallback={<RouteFallback />}>
        <Routes>

          {/* ---------- Sito pubblico ---------- */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/news" element={<News />} />
            <Route path="/chi-siamo" element={<ChiSiamoPage />} />
            <Route path="/galleria" element={<GalleriaPage />} />
            <Route path="/news/:id" element={<NewsDetailPage />} />
            <Route path="/iscrizione" element={<SubscriptionPage />} />
            <Route path="/sports" element={<SportPage />} />
            <Route path="/calendario" element={<CalendarPage />} />
            <Route path="/contatti" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/tutela-minori" element={<TutelaMinoriPage />} />
            <Route path="/contributi-pubblici" element={<ContributiPage />} />
            <Route path="/cinquepermille" element={<CinquePerMillePage />} />
            <Route path="/sponsor" element={<SponsorPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* ---------- Area riservata ---------- */}
          <Route path="/login" element={<AdminRoot section="login" />} />
          {/* La registrazione degli atleti passa dallo stesso bundle
              dell'area riservata: il sito pubblico non se la porta dietro. */}
          <Route path="/registrati" element={<AdminRoot section="registrazione" />} />
          <Route path="/admin/*" element={<AdminRoot section="admin" />} />

        </Routes>
      </Suspense>
    </>
  );
}
