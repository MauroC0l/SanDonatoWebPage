import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaCalendarAlt, FaMapMarkerAlt, FaExclamationCircle,
  FaArrowRight, FaHourglassHalf, FaTimesCircle, FaUsers, FaEuroSign,
  FaPhoneAlt, FaUserCircle, FaClipboardCheck
} from "react-icons/fa";
import { getCruscotto, getIscrizione, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { statoCertificato, quantoManca } from "../../utils/certificato";
import { linkMappa } from "../../utils/linkMappa";
import { euro } from "../../utils/soldi";
import "../../css/Admin.css";
import "../../css/AreaAtleta.css";

const NOME_TIPO = {
  partita: "Partita",
  allenamento: "Allenamento",
  torneo: "Torneo",
  riunione: "Riunione",
  evento: "Evento"
};

/*
 * Le voci di "cosa manca" che il server scrive, divise per dove si
 * compilano. Da quando i recapiti hanno una pagina loro, "completala" non
 * può mandare tutti all'iscrizione: chi ha solo il telefono da scrivere ci
 * arriverebbe e non troverebbe la casella.
 *
 * Le voci del certificato non stanno qui: del certificato si parla col suo
 * stato (manca, scaduto, respinto…), che dice molto più di "manca la
 * copia". Una voce nuova che il server aggiungesse domani finisce fra i
 * dati, dove sta tutto il resto del modulo.
 */
const DAI_CONTATTI = ["un numero di telefono", "il contatto di un genitore"];
const DEL_CERTIFICATO = ["la scadenza del certificato medico", "la copia del certificato medico"];

/** "a, b e c": come lo si direbbe a voce */
function elenco(voci) {
  if (voci.length <= 1) return voci.join("");
  return `${voci.slice(0, -1).join(", ")} e ${voci[voci.length - 1]}`;
}

/* quantoManca dice "fra 12 giorni" ma anche "scade oggi": qui serve sempre
   una frase che cominci col verbo. */
function scadenzaDetta(giorni) {
  const detta = quantoManca(giorni);
  if (!detta) return "";
  return detta.startsWith("scad") ? detta : `scade ${detta}`;
}

/**
 * Il passo del certificato, per ogni stato possibile.
 *
 * Una tabella e non una fila di condizioni: quando gli stati sono passati
 * da quattro a sette — con il file mancante, il controllo in corso e il
 * rifiuto — i tre nuovi non comparivano da nessuna parte. Il ripiego in
 * fondo fa sì che un altro stato aggiunto domani dica comunque qualcosa.
 *
 * "stato" è quello del passo: fatto, manca (c'è un pulsante) o attesa
 * (tocca alla segreteria, e l'atleta non deve fare niente).
 */
function passoCertificato(cert) {
  const tabella = {
    mancante: {
      stato: "manca",
      testo: "Senza il certificato non puoi allenarti né giocare. Una foto ben leggibile va bene.",
      azione: "Carica il certificato"
    },
    senza_file: {
      stato: "manca",
      testo: "Hai scritto la scadenza, ma manca la foto o il PDF del certificato.",
      azione: "Carica la copia"
    },
    da_controllare: {
      stato: "attesa",
      testo: "L'hai consegnato: la segreteria lo sta controllando. Non devi fare niente."
    },
    respinto: {
      stato: "manca",
      testo: "La segreteria l'ha respinto: nella pagina Iscrizione trovi il motivo. Caricane uno nuovo.",
      azione: "Carica quello nuovo"
    },
    scaduto: {
      stato: "manca",
      testo: "È scaduto: finché non lo rinnovi non puoi scendere in campo.",
      azione: "Carica quello nuovo"
    },
    in_scadenza: {
      stato: "manca",
      testo: `È valido, ma ${scadenzaDetta(cert.giorni)}: conviene prenotare subito la visita.`,
      azione: "Carica quello nuovo"
    },
    valido: {
      stato: "fatto",
      testo: `Controllato dalla segreteria, ${scadenzaDetta(cert.giorni)}.`
    }
  };

  return tabella[cert.chiave] ?? {
    stato: "manca",
    testo: cert.etichetta,
    azione: "Vai al certificato"
  };
}

/**
 * Il passo della quota.
 *
 * La quota è in due metà e la seconda si versa da gennaio: chi ha pagato
 * la prima è in regola fino ad allora, e dirgli "ti mancano 175 €" a
 * settembre gli farebbe credere di essere in ritardo.
 */
function passoQuota(iscrizione, oggi) {
  if (!iscrizione) return null;

  const quota = iscrizione.quotaStagionaleCentesimi ?? null;
  if (quota == null) {
    return {
      stato: "attesa",
      testo: "La segreteria deve ancora dirti quanto pagare. Per ora non devi fare niente."
    };
  }

  const conto = iscrizione.conto ?? null;
  const dovuto = conto?.dovuto ?? quota;
  const versato = iscrizione.versatoCentesimi ?? 0;
  const resto = dovuto - versato;

  if (resto <= 0) {
    return { stato: "fatto", testo: `Pagata: ${euro(versato)}. Grazie!` };
  }

  const inizioSeconda = iscrizione.stagione?.inizioSecondaMeta ?? null;
  const annoSeconda = inizioSeconda ? ` ${inizioSeconda.slice(0, 4)}` : "";
  const secondaGiaDovuta = inizioSeconda ? oggi >= new Date(`${inizioSeconda}T00:00:00`) : false;
  const inDueMeta = conto?.primaMeta != null && conto.secondaDovuta;

  if (inDueMeta && versato >= conto.primaMeta && !secondaGiaDovuta) {
    return {
      stato: "fatto",
      testo: `Prima metà pagata. La seconda (${euro(dovuto - versato)}) si paga da gennaio${annoSeconda}.`
    };
  }

  return {
    stato: "manca",
    testo: `Restano da pagare ${euro(resto)}.`,
    nota: inDueMeta && versato < conto.primaMeta
      ? versato > 0
        ? `Puoi pagare tutto adesso, oppure solo quello che manca alla prima metà (${euro(conto.primaMeta - versato)}) e il resto da gennaio${annoSeconda}.`
        : `Puoi pagare tutto adesso, oppure metà adesso (${euro(conto.primaMeta)}) e metà da gennaio${annoSeconda}.`
      : null,
    azione: `Paga ${euro(resto)}`
  };
}

function quando(iso) {
  return new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

function ora(iso) {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function Luogo({ evento }) {
  if (!evento.luogo) return null;
  const mappa = linkMappa({
    luogo: evento.luogo,
    latitudine: evento.latitudine,
    longitudine: evento.longitudine
  });

  return mappa ? (
    <a href={mappa} target="_blank" rel="noreferrer" className="adm-inline-link">
      <FaMapMarkerAlt aria-hidden="true" /> {evento.luogo}
    </a>
  ) : (
    <span><FaMapMarkerAlt aria-hidden="true" /> {evento.luogo}</span>
  );
}

/**
 * La prima schermata di un atleta — o, più spesso, di sua madre.
 *
 * Deve rispondere in un colpo d'occhio a una domanda sola: "manca qualcosa?".
 * Per questo in cima c'è l'elenco delle quattro cose che fanno un iscritto
 * in regola (dati, contatti, certificato, quota), ognuna con il suo stato
 * e, se manca, UN pulsante che porta esattamente dove la si sistema. Prima
 * le stesse informazioni c'erano, ma sparse in un riquadro del certificato
 * e in una frase lunga con cinque cose separate da virgole: si leggeva, ma
 * non si capiva da dove cominciare.
 *
 * Sotto, quando si gioca. Il resto è a un tocco, nelle tessere in fondo.
 */
export default function HomeAtleta() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();

  const [dati, setDati] = useState(null);
  const [iscrizione, setIscrizione] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState("");

  const [oggi] = useState(() => new Date());

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Caricamento non riuscito.");
  }, [navigate, sessionExpired]);

  useEffect(() => {
    let attivo = true;

    /* Il cruscotto dice squadra, certificato e appuntamenti; l'iscrizione
       la quota e l'elenco completo di cosa manca (con il genitore, per i
       minori). Se la seconda non arriva la home si mostra lo stesso, senza
       il passo della quota: meglio mezza risposta che una pagina d'errore. */
    Promise.all([getCruscotto(), getIscrizione().catch(() => null)])
      .then(([c, i]) => {
        if (!attivo) return;
        setDati(c);
        setIscrizione(i);
        setCaricamento(false);
      })
      .catch((err) => {
        if (!attivo) return;
        gestisciErrore(err);
        setCaricamento(false);
      });

    return () => { attivo = false; };
  }, [gestisciErrore]);

  if (caricamento) {
    return (
      <div className="adm-page aa-pagina" aria-busy="true">
        <span className="adm-sagoma adm-sagoma-scheda" style={{ height: "9rem" }} />
        <span className="adm-sagoma adm-sagoma-titolo" style={{ marginTop: "1.5rem" }} />
        <span className="adm-sagoma adm-sagoma-scheda" />
        <span className="adm-sagoma adm-sagoma-scheda" />
      </div>
    );
  }

  if (!dati) {
    return (
      <div className="adm-alert adm-alert-error" role="alert">
        <FaExclamationCircle /> <span>{errore || "Non riesco a leggere i tuoi dati."}</span>
      </div>
    );
  }

  const { appartenenza, appuntamenti } = dati;
  const manca = iscrizione?.manca ?? dati.manca ?? [];

  const cert = statoCertificato(dati.certificatoScadenza, oggi, {
    fileCaricato: dati.certificatoCaricato,
    validazione: dati.certificatoStato
  });

  const inAttesa = appartenenza?.stato === "in_attesa";
  const respinta = appartenenza?.stato === "rifiutata";
  const inSquadra = appartenenza?.stato === "approvata";

  const nome = (user?.name ?? "").trim().split(/\s+/)[0] || "";

  /* ---------- I quattro passi ---------- */

  const mancaDati = manca.filter((m) => !DAI_CONTATTI.includes(m) && !DEL_CERTIFICATO.includes(m));
  const mancaContatti = manca.filter((m) => DAI_CONTATTI.includes(m));
  const certificatoRichiesto = iscrizione?.certificatoRichiesto !== false;

  const passi = [
    {
      chiave: "dati",
      titolo: "I tuoi dati",
      ...(mancaDati.length === 0
        ? { stato: "fatto", testo: "Data di nascita e codice fiscale ci sono." }
        : {
          stato: "manca",
          testo: `Manca ${elenco(mancaDati)}.`,
          azione: "Completa i tuoi dati",
          a: "/area-riservata/iscrizione#dati"
        })
    },
    {
      chiave: "contatti",
      titolo: "Un numero per chiamarti",
      ...(mancaContatti.length === 0
        ? { stato: "fatto", testo: "Sappiamo chi chiamare se serve." }
        : {
          stato: "manca",
          testo: `Manca ${elenco(mancaContatti)}.`,
          azione: "Aggiungi i contatti",
          a: "/area-riservata/contatti"
        })
    },
    certificatoRichiesto && {
      chiave: "certificato",
      titolo: "Il certificato medico",
      a: "/area-riservata/iscrizione#certificato",
      ...passoCertificato(cert)
    },
    iscrizione && {
      chiave: "quota",
      titolo: "La quota",
      a: "/area-riservata/quota?paga=1",
      ...passoQuota(iscrizione, oggi)
    }
  ].filter(Boolean);

  const daFare = passi.filter((p) => p.stato === "manca");
  const fatti = passi.filter((p) => p.stato === "fatto").length;
  const primo = daFare[0]?.chiave;

  const frase = daFare.length === 0
    ? passi.some((p) => p.stato === "attesa")
      ? "Hai fatto tutto quello che dovevi. Ora tocca alla segreteria."
      : "Sei a posto: iscrizione completa e quota pagata. Buon allenamento!"
    : daFare.length === 1
      ? "Ti manca una cosa sola per essere in regola. Qui sotto trovi il pulsante."
      : `Ti mancano ${daFare.length} cose per essere in regola. Qui sotto, un pulsante per ciascuna.`;

  const quotaPasso = passi.find((p) => p.chiave === "quota");

  return (
    <div className="adm-page aa-pagina">
      <header className="adm-benvenuto">
        <p className="adm-occhiello">La tua area</p>
        <h1 className="adm-benvenuto-titolo">
          Ciao{nome && <>, <em>{nome}</em></>}
        </h1>

        {inSquadra ? (
          <>
            <p className="adm-benvenuto-testo">{frase}</p>

            <div className="aa-benvenuto-conta">
              <span
                className={`aa-benvenuto-barra ${daFare.length === 0 ? "is-completa" : ""}`}
                role="img"
                aria-label={`${fatti} cose a posto su ${passi.length}`}
              >
                <span style={{ width: `${Math.round((fatti / passi.length) * 100)}%` }} />
              </span>
              <span className="aa-benvenuto-numeri">{fatti} su {passi.length} a posto</span>
            </div>

            <p className="aa-benvenuto-squadra">
              <FaUsers aria-hidden="true" /> {appartenenza.squadra}
            </p>
          </>
        ) : (
          <p className="adm-benvenuto-testo">
            Qui trovi tutto quello che riguarda la tua iscrizione alla Polisportiva.
          </p>
        )}
      </header>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {inAttesa && (
        <div className="adm-alert adm-alert-info">
          <FaHourglassHalf />
          <span>
            La tua richiesta per {appartenenza.sportChiesto} è arrivata: adesso
            l&apos;allenatore o la segreteria devono assegnarti a una squadra.
            Appena succede, qui trovi allenamenti e partite.
          </span>
        </div>
      )}

      {respinta && (
        <div className="adm-alert adm-alert-error" role="status">
          <FaTimesCircle />
          <span>
            La richiesta per {appartenenza.sportChiesto} è stata respinta
            {appartenenza.motivoRifiuto ? `: ${appartenenza.motivoRifiuto}` : "."}
            {" "}Per rifarla, parlane con la segreteria.
          </span>
        </div>
      )}

      {inSquadra && (
        <>
          {/* ---------- Cosa manca ---------- */}
          <section className="adm-sezione" aria-labelledby="aa-titolo-passi">
            <div className="adm-sezione-testa">
              <div>
                <h2 className="adm-sezione-titolo" id="aa-titolo-passi">
                  <FaClipboardCheck aria-hidden="true" /> Per essere in regola
                </h2>
                <p className="adm-sezione-sotto">
                  Le cose che servono per allenarti e giocare quest&apos;anno.
                </p>
              </div>
            </div>

            <div className="adm-panel aa-lista">
              <ol className="adm-passi">
                {passi.map((p) => {
                  const classe = p.stato === "fatto"
                    ? "is-fatto"
                    : p.stato === "attesa"
                      ? "aa-in-attesa"
                      : p.chiave === primo ? "is-adesso" : "";

                  return (
                    <li key={p.chiave} className={classe}>
                      <strong>{p.titolo}</strong>
                      <span>
                        {p.testo}
                        {p.nota && <span className="aa-passo-nota">{p.nota}</span>}
                      </span>

                      {/* Un pulsante per ogni cosa che manca, e il primo
                          arancione: è quello da premere adesso. */}
                      {p.stato === "manca" && p.azione && (
                        <Link
                          to={p.a}
                          className={`adm-btn aa-passo-azione ${p.chiave === primo ? "adm-btn-arancio" : "adm-btn-primary"}`}
                        >
                          {p.azione} <FaArrowRight aria-hidden="true" />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          {/* ---------- I prossimi appuntamenti ---------- */}
          <section className="adm-sezione" aria-labelledby="aa-titolo-eventi">
            <div className="adm-sezione-testa">
              <div>
                <h2 className="adm-sezione-titolo" id="aa-titolo-eventi">
                  <FaCalendarAlt aria-hidden="true" /> Quando si gioca
                </h2>
              </div>
              <div className="adm-sezione-azioni">
                <Link to="/area-riservata/squadra" className="adm-btn adm-btn-ghost">
                  Tutto il calendario <FaArrowRight aria-hidden="true" />
                </Link>
              </div>
            </div>

            {appuntamenti.length === 0 ? (
              <div className="adm-vuoto-amico">
                <span className="adm-vuoto-icona"><FaCalendarAlt aria-hidden="true" /></span>
                <h3>Niente in programma, per ora</h3>
                <p>
                  Allenamenti e partite li inserisce l&apos;allenatore: appena lo
                  fa, compaiono qui.
                </p>
              </div>
            ) : (
              <>
                {/* Il prossimo in grande: è quello per cui si apre la pagina
                    il venerdì sera — "domani a che ora, e dove?" */}
                <article className="aa-prossimo">
                  <span className="aa-prossimo-occhiello">Il prossimo</span>
                  <span className="aa-prossimo-quando">
                    {quando(appuntamenti[0].inizio)}
                    {!appuntamenti[0].tuttoIlGiorno && `, ore ${ora(appuntamenti[0].inizio)}`}
                  </span>
                  <span className="aa-prossimo-titolo">{appuntamenti[0].titolo}</span>
                  <div className="aa-prossimo-meta">
                    {NOME_TIPO[appuntamenti[0].tipo] && (
                      <span className="adm-sport-tag">{NOME_TIPO[appuntamenti[0].tipo]}</span>
                    )}
                    <Luogo evento={appuntamenti[0]} />
                  </div>
                </article>

                {appuntamenti.length > 1 && (
                  <ul className="atl-eventi">
                    {appuntamenti.slice(1).map((e) => (
                      <li key={e.id} className="atl-evento">
                        <div className="atl-evento-quando">
                          <span className="atl-evento-giorno">{quando(e.inizio)}</span>
                          {!e.tuttoIlGiorno && <span className="atl-evento-ora">{ora(e.inizio)}</span>}
                        </div>

                        <div className="atl-evento-cosa">
                          <span className="atl-evento-titolo">{e.titolo}</span>
                          <div className="atl-evento-meta">
                            {NOME_TIPO[e.tipo] && <span className="adm-sport-tag">{NOME_TIPO[e.tipo]}</span>}
                            <Luogo evento={e} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          {/* ---------- Tutto il resto, a un tocco ---------- */}
          <section className="adm-sezione" aria-labelledby="aa-titolo-rapide">
            <div className="adm-sezione-testa">
              <h2 className="adm-sezione-titolo" id="aa-titolo-rapide">Vai subito a</h2>
            </div>

            <div className="adm-azioni-rapide">
              <Link to="/area-riservata/squadra" className="adm-tessera-azione">
                <span className="adm-tessera-icona"><FaUsers aria-hidden="true" /></span>
                <span className="adm-tessera-titolo">La tua squadra</span>
                <span className="adm-tessera-testo">Calendario, e come averlo sul telefono</span>
                <FaArrowRight className="adm-tessera-freccia" aria-hidden="true" />
              </Link>

              <Link
                to="/area-riservata/quota"
                className={`adm-tessera-azione ${quotaPasso?.stato === "manca" ? "is-arancio" : quotaPasso?.stato === "fatto" ? "is-ok" : ""}`}
              >
                <span className="adm-tessera-icona"><FaEuroSign aria-hidden="true" /></span>
                <span className="adm-tessera-titolo">Quota e pagamenti</span>
                <span className="adm-tessera-testo">
                  {quotaPasso?.stato === "fatto" ? "In regola" : "Quanto resta e come pagare"}
                </span>
                <FaArrowRight className="adm-tessera-freccia" aria-hidden="true" />
              </Link>

              <Link to="/area-riservata/contatti" className="adm-tessera-azione">
                <span className="adm-tessera-icona"><FaPhoneAlt aria-hidden="true" /></span>
                <span className="adm-tessera-titolo">Contatti</span>
                <span className="adm-tessera-testo">Il tuo numero e quello di un genitore</span>
                <FaArrowRight className="adm-tessera-freccia" aria-hidden="true" />
              </Link>

              <Link to="/area-riservata/profilo" className="adm-tessera-azione">
                <span className="adm-tessera-icona"><FaUserCircle aria-hidden="true" /></span>
                <span className="adm-tessera-titolo">Profilo</span>
                <span className="adm-tessera-testo">Foto, email e password</span>
                <FaArrowRight className="adm-tessera-freccia" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </>
      )}

    </div>
  );
}
