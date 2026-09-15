import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Outlet, useLocation } from "react-router-dom";
import MyNavbar from "./components/AllPages/MyNavbar";
import Hero from "./components/AllPages/Hero";
import TopHeader from "./components/AllPages/TopHeader";
import Footer from "./components/AllPages/Footer";
import HomePage from "./components/Home/HomePage";
import { usePublishedHeight } from "./hooks/usePublishedHeight";
import FasciaDimostrativa from "./components/AllPages/FasciaDimostrativa";
import SagomaAccesso from "./components/AllPages/SagomaAccesso";

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

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />

      {/* Spenta per difetto: si accende solo dove VITE_SITO_DIMOSTRATIVO=1,
          cioè sul progetto della dimostrazione. */}
      <FasciaDimostrativa />

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

          {/* Accesso e registrazione hanno un'attesa loro: la SAGOMA della
              pagina invece della rotella di tutte le altre. Sono le due
              porte che si aprono dal sito pubblico — quindi le più
              attraversate — e hanno una forma sola, che si può disegnare
              in anticipo. Chi guarda riconosce dove sta arrivando prima di
              poterlo leggere, e quando la pagina arriva non si sposta
              niente perché lo spazio era già quello. */}
          <Route
            path="/login"
            element={(
              <Suspense fallback={<SagomaAccesso />}>
                <AdminRoot section="login" />
              </Suspense>
            )}
          />

          {/* La registrazione degli atleti passa dallo stesso bundle
              dell'area riservata: il sito pubblico non se la porta dietro. */}
          <Route
            path="/registrati"
            element={(
              <Suspense fallback={<SagomaAccesso />}>
                <AdminRoot section="registrazione" />
              </Suspense>
            )}
          />
          <Route path="/recupera-password" element={<AdminRoot section="recupero" />} />
          {/* La scelta della password a chi ne ha una provvisoria. Ha un
              indirizzo suo e non resta nascosta dentro al pannello: è una
              tappa obbligata, e deve poterla ricaricare, condividere con chi
              la sta aiutando, o ritrovarla nella cronologia. */}
          <Route path="/select-password" element={<AdminRoot section="scelta-password" />} />

          {/* Il pannello, sotto quattro prefissi: l'indirizzo dice con che
              ruolo ci si sta dentro. Le schermate sono le stesse, e quali
              siano raggiungibili lo decidono le capacità, non il prefisso. */}
          <Route path="/admin/*" element={<AdminRoot section="staff" />} />
          <Route path="/segreteria/*" element={<AdminRoot section="staff" />} />
          <Route path="/editor/*" element={<AdminRoot section="staff" />} />
          <Route path="/coach/*" element={<AdminRoot section="staff" />} />

          {/* L'area dell'atleta: stesso bundle e stessa sessione del pannello,
              schermate diverse. Si chiama con parole sue perché è sua. */}
          <Route path="/area-riservata/*" element={<AdminRoot section="atleta" />} />

        </Routes>
      </Suspense>
    </>
  );
}
