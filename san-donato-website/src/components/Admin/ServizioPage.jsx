import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaSave, FaTimes, FaExclamationCircle, FaPencilAlt } from "react-icons/fa";
import { listSpese, listCategorieServizi, creaServizio, modificaServizio, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useArea } from "../../context/area";
import { useDialoghi } from "../../context/dialoghi";
import { versoCampo, daCampo } from "../../utils/soldi";
import Tendina from "./Tendina";
import CampoData from "./CampoData";
import GestioneCategorieServizi from "./GestioneCategorieServizi";
import "../../css/Admin.css";
import "../../css/admin/Spese.css";

/**
 * Un servizio di Spese sito, nuovo o da correggere, su una pagina sua.
 *
 * Prima il modulo si apriva dentro l'elenco, sotto le cifre, i consumi e i
 * collegamenti: premuto "Aggiungi un servizio" non si vedeva cambiare nulla,
 * perché il modulo era comparso troppo in basso. Così invece si apre in cima
 * e al salvataggio si torna all'elenco.
 */

const GB = 1024 ** 3;

const versoCampoData = (giorno) => (giorno ? `${giorno}T00:00:00` : "");
function giornoLocale(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

export default function ServizioPage() {
  const { id } = useParams();
  const nuovo = !id;
  const navigate = useNavigate();
  const area = useArea();
  const { sessionExpired } = useAuth();
  const { avvisa } = useDialoghi();

  const [elenchi, setElenchi] = useState(null);
  const [modulo, setModulo] = useState(null);
  const [errore, setErrore] = useState("");
  const [occupato, setOccupato] = useState(false);
  const [categorieAperte, setCategorieAperte] = useState(false);

  const esci = useCallback(() => navigate(`${area}/spese`), [navigate, area]);

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  // Categorie, periodicità e misure arrivano dal server insieme all'elenco:
  // lo stesso giro serve a ritrovare il servizio da modificare.
  const carica = useCallback(() => listSpese()
    .then((d) => {
      const servizio = nuovo ? null : d.servizi.find((s) => String(s.id) === String(id));
      if (!nuovo && !servizio) {
        setErrore("Questo servizio non c'è più: forse è stato tolto.");
        return;
      }
      setElenchi({ categorie: d.categorie, periodicita: d.periodicita, misure: d.misure });
      setModulo(moduloDa(servizio));
      setErrore("");
    })
    .catch((err) => {
      if (err instanceof AuthError) gestisciErrore(err);
      else setErrore(err.message || "Il modulo non si è caricato.");
    }), [nuovo, id, gestisciErrore]);

  useEffect(() => { carica(); }, [carica]);

  /* Chiusa la finestra delle categorie, la tendina rilegge l'elenco. Se la
     categoria scelta è stata tolta nel frattempo, si torna su "Altro". */
  const chiudiCategorie = async () => {
    setCategorieAperte(false);
    try {
      const categorie = await listCategorieServizi();
      setElenchi((e) => ({ ...e, categorie }));
      setModulo((m) => (categorie.some((c) => c.valore === m.categoria) ? m : { ...m, categoria: "altro" }));
    } catch (err) {
      gestisciErrore(err);
    }
  };

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
      navigate(`${area}/spese`, { replace: true });
    } catch (err) {
      gestisciErrore(err);
      setOccupato(false);
    }
  };

  const indietro = (
    <button type="button" className="adm-btn adm-btn-ghost spe-indietro" onClick={esci}>
      <FaArrowLeft aria-hidden="true" /> Spese sito
    </button>
  );

  if (errore) {
    return (
      <div className="adm-page spe-pagina">
        {indietro}
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle aria-hidden="true" /> <span>{errore}</span>
          <button type="button" className="adm-btn adm-btn-ghost adm-btn-piccolo" onClick={carica}>Riprova</button>
        </div>
      </div>
    );
  }

  if (!modulo) {
    return (
      <div className="adm-page spe-pagina" aria-busy="true">
        <span className="adm-sagoma adm-sagoma-titolo" />
        <span className="adm-sagoma adm-sagoma-scheda" />
      </div>
    );
  }

  const m = modulo;
  const { categorie, periodicita, misure } = elenchi;

  return (
    <div className="adm-page spe-pagina">
      {indietro}
      <div className="adm-page-head">
        <div className="adm-head-left">
          <p className="adm-occhiello">Spese sito</p>
          <h1 className="adm-page-title">{nuovo ? "Nuovo servizio" : `Modifica "${m.nome}"`}</h1>
        </div>
      </div>

      <form className="adm-panel spe-modulo" onSubmit={salva}>
        <div className="spe-griglia">
          <label className="adm-field">
            <span className="adm-label">Nome</span>
            <input className="adm-input" value={m.nome} onChange={(e) => campo("nome")(e.target.value)}
              placeholder="Es. Neon" maxLength={120} required disabled={occupato} autoFocus={nuovo} />
          </label>
          <div className="adm-field">
            <div className="adm-label-riga">
              <span className="adm-label">Di che cosa si tratta</span>
              <button type="button" className="spe-gestisci" onClick={() => setCategorieAperte(true)} disabled={occupato}>
                <FaPencilAlt aria-hidden="true" /> Modifica le voci
              </button>
            </div>
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
            <FaSave aria-hidden="true" /> {occupato ? "Salvataggio…" : "Salva"}
          </button>
          <button type="button" className="adm-btn adm-btn-ghost" onClick={esci} disabled={occupato}>
            <FaTimes aria-hidden="true" /> Annulla
          </button>
        </div>
      </form>

      {categorieAperte && <GestioneCategorieServizi onChiudi={chiudiCategorie} />}
    </div>
  );
}
