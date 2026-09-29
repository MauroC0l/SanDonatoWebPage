import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaPlus, FaPencilAlt, FaSave, FaTimes, FaTrashAlt, FaExternalLinkAlt,
  FaExclamationCircle, FaExclamationTriangle, FaCheckCircle, FaPowerOff,
  FaDatabase, FaCloud, FaServer, FaEnvelope, FaGlobe, FaCalendarCheck,
  FaCodeBranch, FaPuzzlePiece, FaPlug
} from "react-icons/fa";
import { listSpese, creaServizio, modificaServizio, eliminaServizio, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { euro, versoCampo, daCampo } from "../../utils/soldi";
import { byteLeggibili } from "../../utils/byte";
import Tendina from "./Tendina";
import CampoData from "./CampoData";
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

const GB = 1024 ** 3;

const versoCampoData = (giorno) => (giorno ? `${giorno}T00:00:00` : "");
function giornoLocale(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const dataLeggibile = (giorno) => new Date(`${giorno}T00:00:00`).toLocaleDateString("it-IT", {
  day: "numeric", month: "long", year: "numeric"
});

function moduloDa(s) {
  return {
    id: s?.id ?? null,
    nome: s?.nome ?? "",
    categoria: s?.categoria ?? "altro",
    serveA: s?.serveA ?? "",
    account: s?.account ?? "",
    piano: s?.piano ?? "",
    importo: versoCampo(s?.importoCentesimi ?? 0),
    periodicita: s?.periodicita ?? "gratis",
    rinnovoIl: s?.rinnovoIl ?? "",
    limiti: s?.limiti ?? "",
    urlPannello: s?.urlPannello ?? "",
    note: s?.note ?? "",
    misura: s?.misura ?? "",
    sogliaGb: s?.sogliaByte ? String(+(s.sogliaByte / GB).toFixed(2)).replace(".", ",") : "",
    attivo: s?.attivo ?? true
  };
}

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
  const { sessionExpired } = useAuth();
  const { avvisa, conferma } = useDialoghi();

  const [dati, setDati] = useState(null);
  const [errore, setErrore] = useState("");
  const [modulo, setModulo] = useState(null);
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

  const campo = (nome) => (valore) => setModulo((m) => ({ ...m, [nome]: valore }));

  const salva = async (evento) => {
    evento.preventDefault();
    const m = modulo;
    const importoCentesimi = m.periodicita === "gratis" ? 0 : daCampo(m.importo);
    if (m.periodicita !== "gratis" && importoCentesimi == null) {
      avvisa("Scrivi l'importo in euro, per esempio 12,50.", "errore");
      return;
    }
    const soglia = m.misura && m.sogliaGb.trim() ? Number(m.sogliaGb.replace(",", ".")) : null;
    if (m.misura && (soglia == null || !(soglia > 0))) {
      avvisa("Scrivi quanti GB comprende il piano, per esempio 0,5.", "errore");
      return;
    }

    const corpo = {
      nome: m.nome.trim(),
      categoria: m.categoria,
      serveA: m.serveA,
      account: m.account,
      piano: m.piano,
      importoCentesimi: importoCentesimi ?? 0,
      periodicita: m.periodicita,
      rinnovoIl: m.rinnovoIl || null,
      limiti: m.limiti,
      urlPannello: m.urlPannello.trim(),
      note: m.note,
      misura: m.misura || null,
      sogliaByte: soglia ? Math.round(soglia * GB) : null,
      attivo: m.attivo
    };

    setOccupato(true);
    try {
      if (m.id) await modificaServizio(m.id, corpo);
      else await creaServizio(corpo);
      avvisa(m.id ? "Servizio salvato." : "Servizio aggiunto.");
      setModulo(null);
      await ricarica();
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setOccupato(false);
    }
  };

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

  const { servizi, consumi, riepilogo, collegamenti, categorie, periodicita, misure } = dati;
  const etichettaCategoria = (v) => categorie.find((c) => c.valore === v)?.etichetta ?? v;
  const attivi = servizi.filter((s) => s.attivo);
  const spenti = servizi.filter((s) => !s.attivo);

  /* ---------- Il modulo ---------- */
  const disegnaModulo = () => {
    const m = modulo;
    return (
      <form className="adm-panel spe-modulo" onSubmit={salva}>
        <h2 className="adm-panel-title">
          {m.id ? <FaPencilAlt aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
          {m.id ? ` Modifica "${m.nome}"` : " Nuovo servizio"}
        </h2>

        <div className="spe-griglia">
          <label className="adm-field">
            <span className="adm-label">Nome</span>
            <input className="adm-input" value={m.nome} onChange={(e) => campo("nome")(e.target.value)}
              placeholder="Es. Neon" maxLength={120} required disabled={occupato} />
          </label>
          <div className="adm-field">
            <span className="adm-label">Di che cosa si tratta</span>
            <Tendina valore={m.categoria} onChange={campo("categoria")} opzioni={categorie}
              etichettaAria="Categoria del servizio" cercabile={false} disabilitato={occupato} />
          </div>
        </div>

        <label className="adm-field">
          <span className="adm-label">A cosa serve</span>
          <textarea className="adm-input" rows={2} value={m.serveA} onChange={(e) => campo("serveA")(e.target.value)}
            placeholder="Es. Il database: atleti, quote, notizie." maxLength={600} disabled={occupato} />
        </label>

        <div className="spe-griglia">
          <label className="adm-field">
            <span className="adm-label">Con quale account si entra</span>
            <input className="adm-input" value={m.account} onChange={(e) => campo("account")(e.target.value)}
              placeholder="Es. segreteria@… oppure «con GitHub»" maxLength={200} disabled={occupato} />
            <span className="adm-hint">Solo il nome o l&apos;email: <strong>mai la password</strong>.</span>
          </label>
          <label className="adm-field">
            <span className="adm-label">Piano</span>
            <input className="adm-input" value={m.piano} onChange={(e) => campo("piano")(e.target.value)}
              placeholder="Es. Free, Pro" maxLength={120} disabled={occupato} />
          </label>
        </div>

        <div className="spe-griglia spe-griglia-tre">
          <div className="adm-field">
            <span className="adm-label">Si paga</span>
            <Tendina valore={m.periodicita} onChange={campo("periodicita")} opzioni={periodicita}
              etichettaAria="Ogni quanto si paga" cercabile={false} disabilitato={occupato} />
          </div>
          <label className="adm-field">
            <span className="adm-label">Importo (€)</span>
            <input className="adm-input" inputMode="decimal" value={m.periodicita === "gratis" ? "" : m.importo}
              onChange={(e) => campo("importo")(e.target.value)} placeholder={m.periodicita === "gratis" ? "—" : "Es. 12,50"}
              disabled={occupato || m.periodicita === "gratis"} />
          </label>
          <div className="adm-field">
            <span className="adm-label">Prossimo rinnovo <em>(facoltativo)</em></span>
            <CampoData valore={versoCampoData(m.rinnovoIl)} onChange={(v) => campo("rinnovoIl")(v ? giornoLocale(v) : "")}
              disabilitato={occupato} etichettaAria="Data del prossimo rinnovo" segnaposto="Scegli il giorno" />
          </div>
        </div>

        <label className="adm-field">
          <span className="adm-label">Cosa comprende il piano <em>(facoltativo)</em></span>
          <textarea className="adm-input" rows={2} value={m.limiti} onChange={(e) => campo("limiti")(e.target.value)}
            placeholder="Es. Gratis fino a 10 GB, poi 0,015 $ per GB al mese." maxLength={1000} disabled={occupato} />
        </label>

        <div className="spe-griglia">
          <label className="adm-field">
            <span className="adm-label">Indirizzo del pannello <em>(facoltativo)</em></span>
            <input className="adm-input" type="url" value={m.urlPannello} onChange={(e) => campo("urlPannello")(e.target.value)}
              placeholder="https://…" maxLength={500} disabled={occupato} />
          </label>
          <div className="adm-field">
            <span className="adm-label">Consumo da misurare <em>(facoltativo)</em></span>
            <Tendina valore={m.misura} onChange={campo("misura")}
              opzioni={[{ valore: "", etichetta: "Nessuno" }, ...misure]}
              etichettaAria="Consumo che il sito misura" cercabile={false} disabilitato={occupato} />
          </div>
        </div>

        {m.misura && (
          <label className="adm-field spe-soglia">
            <span className="adm-label">Spazio compreso nel piano (GB)</span>
            <input className="adm-input" inputMode="decimal" value={m.sogliaGb} onChange={(e) => campo("sogliaGb")(e.target.value)}
              placeholder="Es. 0,5" disabled={occupato} />
            <span className="adm-hint">Oltre l&apos;80% la home lo segnala.</span>
          </label>
        )}

        <label className="adm-field">
          <span className="adm-label">Note <em>(facoltativo)</em></span>
          <textarea className="adm-input" rows={2} value={m.note} onChange={(e) => campo("note")(e.target.value)}
            maxLength={1000} disabled={occupato} />
        </label>

        <div className="adm-scheda-azioni">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={occupato}>
            <FaSave aria-hidden="true" /> Salva
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setModulo(null)} disabled={occupato}>
            <FaTimes aria-hidden="true" /> Annulla
          </button>
        </div>
      </form>
    );
  };

  /* ---------- Un servizio ---------- */
  const disegnaServizio = (s) => {
    if (modulo?.id === s.id) return <li key={s.id}>{disegnaModulo()}</li>;
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
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-piccolo" onClick={() => setModulo(moduloDa(s))} disabled={occupato || !!modulo}>
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
        {!modulo && (
          <div className="adm-head-actions">
            <button type="button" className="adm-btn adm-btn-primary" onClick={() => setModulo(moduloDa(null))}>
              <FaPlus aria-hidden="true" /> Aggiungi un servizio
            </button>
          </div>
        )}
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
        {modulo && !modulo.id && disegnaModulo()}
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
