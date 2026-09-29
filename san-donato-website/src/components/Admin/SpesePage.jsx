import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useArea } from "../../context/area";
import {
  FaPlus, FaPencilAlt, FaTrashAlt, FaExternalLinkAlt,
  FaExclamationCircle, FaExclamationTriangle, FaCheckCircle, FaPowerOff,
  FaDatabase, FaCloud, FaServer, FaEnvelope, FaGlobe, FaCalendarCheck,
  FaCodeBranch, FaPuzzlePiece, FaPlug
} from "react-icons/fa";
import { listSpese, modificaServizio, eliminaServizio, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { euro } from "../../utils/soldi";
import { byteLeggibili } from "../../utils/byte";
import "../../css/Admin.css";
import "../../css/admin/Spese.css";

/**
 * Spese sito: su quali servizi esterni si regge il sito, con quale account
 * si entra in ciascuno, cosa comprende il piano e quanto costa.
 *
 * Chiesta dalla società il 29 settembre 2026. Il punto non è solo il conto:
 * è che chi subentra trovi scritto dove sta ogni pezzo, invece di doverlo
 * ricostruire chiedendo in giro.
 *
 * Gli importi li scrive l'amministratore; i consumi (database e archivio dei
 * file) li misura il sito a ogni apertura, perché sono loro a crescere da
 * soli fino alla soglia oltre la quale si paga.
 *
 * Il modulo per aggiungere o correggere un servizio sta in ServizioPage, su
 * un indirizzo suo: dentro questa pagina finiva troppo in basso.
 */

const ICONA_CATEGORIA = {
  sito: FaServer,
  database: FaDatabase,
  file: FaCloud,
  email: FaEnvelope,
  dominio: FaGlobe,
  calendari: FaCalendarCheck,
  codice: FaCodeBranch,
  altro: FaPuzzlePiece
};

const dataLeggibile = (giorno) => new Date(`${giorno}T00:00:00`).toLocaleDateString("it-IT", {
  day: "numeric", month: "long", year: "numeric"
});

/** Il costo scritto per esteso: "Gratuito", "12,00 € al mese". */
function costoLeggibile(s) {
  if (s.periodicita === "gratis" || !s.importoCentesimi) {
    return s.periodicita === "gratis" ? "Gratuito" : "Importo da compilare";
  }
  const quando = { mese: "al mese", anno: "all'anno", una_tantum: "una tantum" }[s.periodicita] ?? "";
  return `${euro(s.importoCentesimi)} ${quando}`;
}

export default function SpesePage() {
  const navigate = useNavigate();
  const area = useArea();
  const { sessionExpired } = useAuth();
  const { avvisa, conferma } = useDialoghi();

  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState("");
  const [occupato, setOccupato] = useState(false);

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  const ricarica = useCallback(() => listSpese()
    .then((d) => { setDati(d); setErrore(""); })
    .catch((err) => {
      if (err instanceof AuthError) gestisciErrore(err);
      else setErrore(err.message || "Le spese non si sono caricate.");
    }), [gestisciErrore]);

  useEffect(() => { ricarica(); }, [ricarica]);

  const accendiSpegni = async (s) => {
    setOccupato(true);
    try {
      await modificaServizio(s.id, { attivo: !s.attivo });
      avvisa(s.attivo ? `"${s.nome}" segnato come non più usato.` : `"${s.nome}" di nuovo fra quelli in uso.`);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setOccupato(false);
    }
  };

  const togli = async (s) => {
    const ok = await conferma({
      titolo: `Togliere "${s.nome}"?`,
      testo: "Sparisce dall'elenco con account, piano e note. Se il servizio è solo stato lasciato, meglio \"Non più usato\": ne resta traccia.",
      conferma: "Togli",
      pericolo: true
    });
    if (!ok) return;
    setOccupato(true);
    try {
      await eliminaServizio(s.id);
      avvisa(`"${s.nome}" tolto dalle spese.`);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setOccupato(false);
    }
  };

  if (!dati && !errore) {
    return (
      <div className="adm-page spe-pagina" aria-busy="true">
        <span className="adm-sagoma adm-sagoma-titolo" />
        <span className="adm-sagoma adm-sagoma-riga" style={{ width: "min(80%, 30rem)" }} />
        <span className="adm-sagoma adm-sagoma-scheda" />
        <span className="adm-sagoma adm-sagoma-scheda" />
      </div>
    );
  }

  if (!dati) {
    return (
      <div className="adm-page spe-pagina">
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle aria-hidden="true" /> <span>{errore}</span>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-piccolo" onClick={ricarica}>Riprova</button>
        </div>
      </div>
    );
  }

  const { servizi, consumi, riepilogo, collegamenti, categorie } = dati;
  const etichettaCategoria = (v) => categorie.find((c) => c.valore === v)?.etichetta ?? v;
  const attivi = servizi.filter((s) => s.attivo);
  const spenti = servizi.filter((s) => !s.attivo);

  /* ---------- Un servizio ---------- */
  const disegnaServizio = (s) => {
    const Icona = ICONA_CATEGORIA[s.categoria] ?? FaPuzzlePiece;
    const uso = riepilogo.usi.find((u) => u.servizioId === s.id);
    const righe = [
      ["A cosa serve", s.serveA],
      ["Account", s.account],
      ["Piano", s.piano],
      ["Cosa comprende", s.limiti],
      ["Rinnovo", s.rinnovoIl ? dataLeggibile(s.rinnovoIl) : null],
      ["Note", s.note]
    ].filter(([, v]) => v);

    return (
      <li key={s.id} className={`adm-panel spe-servizio ${s.attivo ? "" : "is-spento"}`}>
        <header className="spe-servizio-testa">
          <span className="spe-servizio-icona"><Icona aria-hidden="true" /></span>
          <div className="spe-servizio-nome">
            <h3>{s.nome}</h3>
            <span className="adm-hint">{etichettaCategoria(s.categoria)}</span>
          </div>
          <span className={`spe-costo ${s.periodicita === "gratis" ? "is-gratis" : ""}`}>{costoLeggibile(s)}</span>
        </header>

        <dl className="spe-dati">
          {righe.map(([etichetta, valore]) => (
            <div key={etichetta} className={/da compilare/i.test(valore) ? "is-da-compilare" : ""}>
              <dt>{etichetta}</dt>
              <dd>{valore}</dd>
            </div>
          ))}
          {uso && (
            <div>
              <dt>Occupato adesso</dt>
              <dd>{byteLeggibili(uso.byte)} di {byteLeggibili(uso.sogliaByte)}</dd>
            </div>
          )}
        </dl>

        <div className="spe-servizio-azioni">
          {s.urlPannello && (
            <a className="adm-btn adm-btn-secondary adm-btn-piccolo" href={s.urlPannello} target="_blank" rel="noopener noreferrer">
              Apri il pannello <FaExternalLinkAlt aria-hidden="true" />
            </a>
          )}
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-piccolo" onClick={() => navigate(`${area}/spese/${s.id}`)} disabled={occupato}>
            <FaPencilAlt aria-hidden="true" /> Modifica
          </button>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-piccolo" onClick={() => accendiSpegni(s)} disabled={occupato}>
            <FaPowerOff aria-hidden="true" /> {s.attivo ? "Non più usato" : "Di nuovo in uso"}
          </button>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-piccolo adm-btn-cancella" onClick={() => togli(s)} disabled={occupato}>
            <FaTrashAlt aria-hidden="true" /> Togli
          </button>
        </div>
      </li>
    );
  };

  const COLLEGAMENTI = [
    {
      nome: "Archivio dei file (pubblico)",
      stato: collegamenti.archivioLocale ? "locale" : collegamenti.archivio ? "ok" : "manca",
      spiega: "Immagini, video e documenti caricati dal pannello."
    },
    {
      nome: "Archivio riservato (certificati)",
      stato: collegamenti.archivioLocale ? "locale" : collegamenti.archivioRiservato ? "ok" : "manca",
      spiega: "Senza, i certificati medici non si possono caricare."
    },
    { nome: "Lettura notturna dei calendari", stato: collegamenti.letturaNotturna ? "ok" : "manca", spiega: "Variabile CRON_SECRET su Vercel." },
    { nome: "Chiave di Google Drive", stato: collegamenti.googleDrive ? "ok" : "facoltativa", spiega: "Facoltativa: senza, i calendari si leggono lo stesso." },
    { nome: "Newsletter (MailerLite)", stato: collegamenti.newsletter ? "ok" : "manca", spiega: "Il modulo \"Resta aggiornato\"." }
  ];
  const TESTO_STATO = { ok: "Collegato", manca: "Non collegato", locale: "In locale (prova)", facoltativa: "Non usata" };

  return (
    <div className="adm-page spe-pagina">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <p className="adm-occhiello">Sistema</p>
          <h1 className="adm-page-title">Spese sito</h1>
          <p className="adm-page-sub">
            I servizi esterni su cui si regge il sito: a cosa servono, con quale
            account si entra, cosa comprende il piano e quanto costa. Gli
            importi li scrivi tu dai pannelli; lo spazio occupato lo misura il
            sito, adesso.
          </p>
        </div>
        <div className="adm-head-actions">
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => navigate(`${area}/spese/nuovo`)}>
            <FaPlus aria-hidden="true" /> Aggiungi un servizio
          </button>
        </div>
      </div>

      {/* ---------- I conti ---------- */}
      <section className="spe-cifre" aria-label="Riepilogo delle spese">
        <div className="spe-cifra">
          <span className="spe-cifra-etichetta">Al mese</span>
          <strong>{euro(riepilogo.totali.mese)}</strong>
          <span className="adm-hint">compresi gli annuali divisi per 12</span>
        </div>
        <div className="spe-cifra">
          <span className="spe-cifra-etichetta">All&apos;anno</span>
          <strong>{euro(riepilogo.totali.anno)}</strong>
          <span className="adm-hint">{riepilogo.attivi} servizi in uso</span>
        </div>
        <div className="spe-cifra">
          <span className="spe-cifra-etichetta">Prossimo rinnovo</span>
          <strong>{riepilogo.prossimoRinnovo ? riepilogo.prossimoRinnovo.nome : "Nessuno"}</strong>
          <span className="adm-hint">
            {riepilogo.prossimoRinnovo ? dataLeggibile(riepilogo.prossimoRinnovo.data) : "nessuna data inserita"}
          </span>
        </div>
      </section>

      {(riepilogo.avvisi.length > 0 || riepilogo.daCompilare > 0) && (
        <div className="adm-alert adm-alert-warn spe-avvisi" role="status">
          <FaExclamationTriangle aria-hidden="true" />
          <ul>
            {riepilogo.avvisi.map((a) => <li key={`${a.tipo}-${a.servizioId}`}>{a.testo}</li>)}
            {riepilogo.daCompilare > 0 && (
              <li>
                {riepilogo.daCompilare === 1 ? "Un servizio ha" : `${riepilogo.daCompilare} servizi hanno`} ancora
                account o piano &laquo;da compilare&raquo;: guardali nei pannelli e scrivili qui.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* ---------- Consumi ---------- */}
      <section className="adm-sezione" aria-labelledby="spe-consumi">
        <div className="adm-sezione-testa">
          <div>
            <h2 className="adm-sezione-titolo" id="spe-consumi">Spazio occupato adesso</h2>
            <p className="adm-sezione-sotto">Misurato dal sito all&apos;apertura di questa pagina, rispetto a quanto comprende il piano.</p>
          </div>
        </div>
        <div className="spe-consumi">
          {riepilogo.usi.map((u) => {
            const percento = u.quota == null ? 0 : Math.min(100, u.quota * 100);
            return (
              <div key={u.servizioId} className="adm-panel spe-consumo">
                <p className="spe-consumo-nome">
                  {u.misura === "database" ? <FaDatabase aria-hidden="true" /> : <FaCloud aria-hidden="true" />}
                  {u.misura === "database" ? "Database" : "Archivio dei file"} · {u.nome}
                </p>
                <p className="spe-consumo-cifra">
                  <strong>{byteLeggibili(u.byte)}</strong> di {byteLeggibili(u.sogliaByte)}
                  <span className="adm-hint"> ({percento < 1 ? "meno dell'1" : Math.round(percento)}%)</span>
                </p>
                <div className={`spe-barra ${percento >= 80 ? "is-alta" : ""}`} role="progressbar"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percento)}
                  aria-label={`Spazio occupato: ${Math.round(percento)}%`}>
                  <span style={{ width: `${Math.max(percento, 0.5)}%` }} />
                </div>
                {u.misura === "archivio" && (
                  <p className="adm-hint spe-consumo-nota">
                    {consumi.archivio.file} file, di cui {consumi.archivio.fileRiservati} certificati nel bucket riservato
                    {consumi.archivio.ancoraSuWordpress > 0 && ` · ${consumi.archivio.ancoraSuWordpress} ancora sul vecchio WordPress`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- Collegamenti ---------- */}
      <section className="adm-sezione" aria-labelledby="spe-collegamenti">
        <div className="adm-sezione-testa">
          <div>
            <h2 className="adm-sezione-titolo" id="spe-collegamenti"><FaPlug aria-hidden="true" /> Collegamenti</h2>
            <p className="adm-sezione-sotto">Le chiavi stanno nelle impostazioni di Vercel: qui si vede solo se ci sono, mai il loro valore.</p>
          </div>
        </div>
        <ul className="adm-panel spe-collegamenti">
          {COLLEGAMENTI.map((c) => (
            <li key={c.nome}>
              <span className={`spe-stato is-${c.stato}`}>
                {c.stato === "ok" ? <FaCheckCircle aria-hidden="true" /> : <FaExclamationCircle aria-hidden="true" />}
                {TESTO_STATO[c.stato]}
              </span>
              <span className="spe-collegamento-nome">{c.nome}</span>
              <span className="adm-hint">{c.spiega}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- I servizi ---------- */}
      <section className="adm-sezione" aria-labelledby="spe-servizi">
        <div className="adm-sezione-testa">
          <div>
            <h2 className="adm-sezione-titolo" id="spe-servizi">Servizi in uso</h2>
            <p className="adm-sezione-sotto">Gli account esterni della società, uno per riquadro.</p>
          </div>
        </div>
        <ul className="spe-elenco">{attivi.map(disegnaServizio)}</ul>
      </section>

      {spenti.length > 0 && (
        <section className="adm-sezione" aria-labelledby="spe-spenti">
          <div className="adm-sezione-testa">
            <h2 className="adm-sezione-titolo" id="spe-spenti">Non più usati</h2>
          </div>
          <ul className="spe-elenco">{spenti.map(disegnaServizio)}</ul>
        </section>
      )}
    </div>
  );
}
