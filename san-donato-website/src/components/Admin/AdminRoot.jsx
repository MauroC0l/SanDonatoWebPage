import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "../../context/AuthProvider";
import { DialoghiProvider } from "./DialoghiProvider";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { AREA_ATLETA } from "../../utils/percorsi";
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
const AtletiPage = lazy(() => import("./AtletiPage"));
const SchedaAtletaPage = lazy(() => import("./SchedaAtletaPage"));
const IscrizioniPage = lazy(() => import("./IscrizioniPage"));
const CambioPasswordPage = lazy(() => import("./CambioPasswordPage"));
const ProfiloPage = lazy(() => import("./ProfiloPage"));
const AttesaSquadraPage = lazy(() => import("./AttesaSquadraPage"));
const RegistroPage = lazy(() => import("./RegistroPage"));
const LibreriaPage = lazy(() => import("./LibreriaPage"));
const QuotePage = lazy(() => import("./QuotePage"));
const SquadrePage = lazy(() => import("./SquadrePage"));
const RecuperoPasswordPage = lazy(() => import("./RecuperoPasswordPage"));
const SceltaPasswordPage = lazy(() => import("./SceltaPasswordPage"));
const HomePannello = lazy(() => import("./HomePannello"));

// Area dell'atleta
const AreaAtletaLayout = lazy(() => import("../Atleta/AreaAtletaLayout"));
const SquadraPage = lazy(() => import("../Atleta/SquadraPage"));
const IscrizionePage = lazy(() => import("../Atleta/IscrizionePage"));
const ContattiPage = lazy(() => import("../Atleta/ContattiPage"));
const QuotaPage = lazy(() => import("../Atleta/QuotaPage"));
const HomeAtleta = lazy(() => import("../Atleta/HomeAtleta"));

function Attesa({ cosa }) {
  return (
    <div className="adm-loading">
      <div className="adm-spinner" />
      <p>Apertura {cosa}…</p>
    </div>
  );
}

/** Scorciatoia per non ripetere <Suspense> a ogni rotta pigra. */
function Pigra({ cosa, children }) {
  return <Suspense fallback={<Attesa cosa={cosa} />}>{children}</Suspense>;
}

/**
 * Sbarra una sezione a chi non ha la capacità che serve.
 *
 * Il vero controllo è sul server, e resta lì. Questo evita solo che chi
 * scrive a mano /admin/utenti senza esserne titolato veda una pagina che si
 * riempie di errori: lo rimanda al proprio ingresso, che è una risposta più
 * utile di un elenco vuoto.
 */
function Riservato({ una, children }) {
  const { user } = useAuth();
  const area = useArea();
  const capacita = user?.capabilities ?? [];

  if (user?.role === "atleta") return <Navigate to={AREA_ATLETA} replace />;

  // Chi aspetta ancora una squadra non ha sezioni: solo la propria scheda,
  // che è fuori da questo controllo.
  if (user?.stato === "in_attesa") return <Navigate to={area} replace />;

  const ammesso = una.some((c) => capacita.includes(c));
  return ammesso ? children : <Navigate to={area} replace />;
}

/**
 * Dove si atterra entrando.
 *
 * Non è un elenco, ed è cambiato apposta: prima si finiva dritti sulle
 * notizie o sugli eventi, e toccava scoprire da soli se ci fosse qualcosa da
 * fare. Il cruscotto si compone sulle capacità di chi guarda, quindi una
 * pagina sola va bene per tutti i ruoli.
 */
function Ingresso() {
  const { user } = useAuth();

  // Un atleta capitato sotto un prefisso dello staff ha sbagliato porta.
  if (user?.role === "atleta") return <Navigate to={AREA_ATLETA} replace />;

  if (user?.stato === "in_attesa") {
    return <Pigra cosa="della tua scheda"><AttesaSquadraPage /></Pigra>;
  }

  /**
   * Una home vera, non un rimbalzo.
   *
   * Prima si finiva dritti su un elenco — le notizie per un redattore, gli
   * eventi per un allenatore — e toccava scoprire da soli se ci fosse
   * qualcosa da fare. Il cruscotto si compone sulle capacita di chi guarda,
   * quindi una pagina sola va bene per tutti i ruoli.
   */
  return <Pigra cosa="della tua area"><HomePannello /></Pigra>;
}

/** Vecchio indirizzo .../modifica/:id verso il nuovo .../notizie/:id. */
function VecchiaModifica() {
  const { id } = useParams();
  const area = useArea();
  return <Navigate to={`${area}/notizie/${id}`} replace />;
}

/** Rimanda all'ingresso della propria area, qualunque essa sia. */
function AllIngresso() {
  const area = useArea();
  return <Navigate to={area} replace />;
}

/**
 * Radice dell'area riservata, montata su più percorsi:
 *
 *   /login, /registrati, /recupera-password   le schermate d'ingresso
 *   /admin, /segreteria, /editor, /coach      il pannello
 *   /area-riservata                           l'area dell'atleta
 *
 * Passano tutte da qui perché condividono lo stato della sessione, e perché
 * così autenticazione e chiamate di scrittura restano in un bundle unico:
 * chi visita il sito pubblico non ne scarica una riga.
 */
export default function AdminRoot({ section }) {
  if (section === "login") {
    return (
      <AuthProvider>
        <DialoghiProvider>
          <LoginPage />
        </DialoghiProvider>
      </AuthProvider>
    );
  }

  if (section === "registrazione") {
    return (
      <AuthProvider>
        <DialoghiProvider>
          <RegistrazionePage />
        </DialoghiProvider>
      </AuthProvider>
    );
  }

  if (section === "recupero") {
    return (
      <Suspense fallback={<Attesa cosa="della schermata" />}>
        <RecuperoPasswordPage />
      </Suspense>
    );
  }

  if (section === "scelta-password") {
    return (
      <AuthProvider>
        <DialoghiProvider>
          <Pigra cosa="della schermata"><SceltaPasswordPage /></Pigra>
        </DialoghiProvider>
      </AuthProvider>
    );
  }

  if (section === "atleta") {
    return (
      <AuthProvider>
        <DialoghiProvider>
          <Routes>
            <Route element={<Pigra cosa="della tua area"><AreaAtletaLayout /></Pigra>}>
              {/* All ingresso non un menu ne un modulo, ma la risposta alle
                  tre domande vere: posso giocare, cosa devo fare, quando si
                  gioca. Il profilo e una voce come le altre. */}
              <Route index element={<Pigra cosa="della tua area"><HomeAtleta /></Pigra>} />
              <Route path="profilo" element={<Pigra cosa="del profilo"><ProfiloPage /></Pigra>} />
              <Route path="squadra" element={<Pigra cosa="del calendario"><SquadraPage /></Pigra>} />
              <Route path="iscrizione" element={<Pigra cosa="dell'iscrizione"><IscrizionePage /></Pigra>} />
              <Route path="contatti" element={<Pigra cosa="dei contatti"><ContattiPage /></Pigra>} />
              <Route path="quota" element={<Pigra cosa="della quota"><QuotaPage /></Pigra>} />
              <Route
                path="password"
                element={<Pigra cosa="della schermata"><CambioPasswordPage /></Pigra>}
              />
              <Route path="*" element={<Navigate to={AREA_ATLETA} replace />} />
            </Route>
          </Routes>
        </DialoghiProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <DialoghiProvider>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<Ingresso />} />

            {/* ---------- Notizie ---------- */}
            <Route
              path="notizie"
              element={<Riservato una={["notizie.leggi_bozze"]}><PostsListPage /></Riservato>}
            />
            <Route
              path="notizie/nuova"
              element={
                <Riservato una={["notizie.scrivi"]}>
                  <Pigra cosa="dell'editor"><PostEditorPage /></Pigra>
                </Riservato>
              }
            />
            <Route
              path="notizie/:id"
              element={
                <Riservato una={["notizie.scrivi"]}>
                  <Pigra cosa="dell'editor"><PostEditorPage /></Pigra>
                </Riservato>
              }
            />

            {/* Indirizzi vecchi, già finiti in qualche segnalibro */}
            <Route path="nuova" element={<AllIngresso />} />
            <Route path="modifica/:id" element={<VecchiaModifica />} />

            {/* ---------- Eventi ---------- */}
            {/* ---------- Partite ----------
                Le mette a calendario anche un allenatore, per le proprie
                squadre. Il modulo chiede avversario, risultato e parziali. */}
            <Route
              path="partite"
              element={
                <Riservato una={["eventi.gestisci_tutte", "eventi.gestisci_proprie"]}>
                  <EventiListPage genere="partite" />
                </Riservato>
              }
            />
            <Route
              path="partite/nuova"
              element={
                <Riservato una={["eventi.gestisci_tutte", "eventi.gestisci_proprie"]}>
                  <Pigra cosa="della partita"><EventoEditorPage genere="partite" /></Pigra>
                </Riservato>
              }
            />
            <Route
              path="partite/:id"
              element={
                <Riservato una={["eventi.gestisci_tutte", "eventi.gestisci_proprie"]}>
                  <Pigra cosa="della partita"><EventoEditorPage genere="partite" /></Pigra>
                </Riservato>
              }
            />

            {/* ---------- Eventi ----------
                Assemblee, feste, chiusure della sede: cose della società,
                quindi solo chi amministra. Modulo diverso, stesso
                calendario. */}
            <Route
              path="eventi"
              element={
                <Riservato una={["eventi.gestisci_tutte"]}>
                  <EventiListPage genere="eventi" />
                </Riservato>
              }
            />
            <Route
              path="eventi/nuovo"
              element={
                <Riservato una={["eventi.gestisci_tutte"]}>
                  <Pigra cosa="dell'evento"><EventoEditorPage genere="eventi" /></Pigra>
                </Riservato>
              }
            />
            <Route
              path="eventi/:id"
              element={
                <Riservato una={["eventi.gestisci_tutte"]}>
                  <Pigra cosa="dell'evento"><EventoEditorPage genere="eventi" /></Pigra>
                </Riservato>
              }
            />

            {/* ---------- Richieste di appartenenza ---------- */}
            <Route
              path="richieste"
              element={
                <Riservato una={["iscrizioni.decidi_tutte", "iscrizioni.decidi_proprie"]}>
                  <Pigra cosa="delle richieste"><IscrizioniPage /></Pigra>
                </Riservato>
              }
            />
            <Route path="iscrizioni" element={<AllIngresso />} />

            {/* ---------- Atleti ---------- */}
            <Route
              path="atleti"
              element={
                <Riservato una={["atleti.leggi"]}>
                  <Pigra cosa="degli atleti"><AtletiPage /></Pigra>
                </Riservato>
              }
            />
            <Route
              path="atleti/:id"
              element={
                <Riservato una={["atleti.leggi"]}>
                  <Pigra cosa="della scheda"><SchedaAtletaPage /></Pigra>
                </Riservato>
              }
            />

            {/* ---------- Utenti ---------- */}
            <Route
              path="utenti"
              element={
                <Riservato una={["utenti.gestisci"]}>
                  <Pigra cosa="dell'elenco"><PersonePage /></Pigra>
                </Riservato>
              }
            />
            <Route path="persone" element={<AllIngresso />} />

            {/* ---------- Squadre ---------- */}
            <Route
              path="squadre"
              element={
                <Riservato una={["squadre.gestisci"]}>
                  <Pigra cosa="delle squadre"><SquadrePage /></Pigra>
                </Riservato>
              }
            />

            {/* ---------- Tariffe della stagione ----------
                Le legge chi assegna le quote, le decide chi amministra:
                la differenza la fa il server, non questa rotta. */}
            <Route
              path="quote"
              element={
                <Riservato una={["quote.gestisci"]}>
                  <Pigra cosa="delle tariffe"><QuotePage /></Pigra>
                </Riservato>
              }
            />

            {/* ---------- Libreria dei file ---------- */}
            <Route
              path="libreria"
              element={
                <Riservato una={["notizie.scrivi", "eventi.gestisci_tutte", "eventi.gestisci_proprie"]}>
                  <Pigra cosa="della libreria"><LibreriaPage /></Pigra>
                </Riservato>
              }
            />

            {/* ---------- Registro delle attività ---------- */}
            <Route
              path="registro"
              element={
                <Riservato una={["registro.leggi"]}>
                  <Pigra cosa="del registro"><RegistroPage /></Pigra>
                </Riservato>
              }
            />

            {/* ---------- La propria scheda ----------
                Fuori da <Riservato>: è l'unica pagina che chiunque sia
                entrato deve poter aprire, compreso chi aspetta una squadra. */}
            <Route
              path="profilo"
              element={<Pigra cosa="del profilo"><ProfiloPage /></Pigra>}
            />

            {/* Cambio password volontario: quello obbligatorio lo impone
                AdminLayout prima di mostrare qualunque altra cosa. */}
            <Route
              path="password"
              element={<Pigra cosa="della schermata"><CambioPasswordPage /></Pigra>}
            />

            <Route path="*" element={<AllIngresso />} />
          </Route>
        </Routes>
      </DialoghiProvider>
    </AuthProvider>
  );
}
