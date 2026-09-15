import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSave, FaExclamationCircle, FaPhoneAlt, FaPlus, FaTimes, FaInfoCircle
} from "react-icons/fa";
import { getIscrizione, salvaIscrizione, AuthError } from "../../api/adminApi";
import { useAuth } from "../../context/auth";
import { useDialoghi } from "../../context/dialoghi";
import { minorenne } from "../../utils/eta";
import Tendina from "../Admin/Tendina";
import "../../css/Admin.css";
import "../../css/Iscrizione.css";

/*
 * Chi chiamare, e come.
 *
 * Una schermata sua e non un pezzo dell'iscrizione: i recapiti sono la cosa
 * che cambia più spesso di tutte — si cambia numero, si cambia casa, il
 * genitore che risponde a settembre non è quello che risponde a marzo — e
 * cercarli in fondo a un modulo di venti caselle è il modo di non
 * aggiornarli mai.
 */
const CONTATTI = [
  { prefisso: "tutore", titolo: "Chi chiamare per primo" },
  { prefisso: "tutore2", titolo: "Se non risponde" }
];

const CAMPI_CONTATTO = [
  { suffisso: "Nome", etichetta: "Nome e cognome", max: 120, seMinore: true },
  { suffisso: "Parentela", etichetta: "Chi è", tipo: "scelta" },
  { suffisso: "Telefono", etichetta: "Telefono", max: 40, tipo: "tel", seMinore: true },
  { suffisso: "Email", etichetta: "Email", max: 255, tipo: "email" }
];

/* Chi risponde va saputo prima di chiamare: al telefono si comincia da
   "sono della polisportiva, parlo con la mamma di Marco?" */
const OPZIONI_PARENTELA = [
  "Madre", "Padre", "Nonna", "Nonno", "Zia", "Zio",
  "Sorella", "Fratello", "Tutore", "Altro"
].map((v) => ({ valore: v, etichetta: v }));

const VUOTO = {
  telefono: "",
  tutoreNome: "", tutoreParentela: "", tutoreTelefono: "", tutoreEmail: "",
  tutore2Nome: "", tutore2Parentela: "", tutore2Telefono: "", tutore2Email: ""
};

function daIscrizione(i) {
  const letto = { ...VUOTO };
  for (const chiave of Object.keys(VUOTO)) letto[chiave] = i?.[chiave] ?? "";
  return letto;
}

export default function ContattiPage() {
  const navigate = useNavigate();
  const { user, sessionExpired } = useAuth();
  const { avvisa } = useDialoghi();

  const [iscrizione, setIscrizione] = useState(null);
  const [form, setForm] = useState(VUOTO);
  const [caricamento, setCaricamento] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState("");

  /* Solo "è stato chiesto": se il secondo contatto è già compilato si apre
     da sé, e questo stato non serve a ricordarlo. */
  const [secondoChiesto, setSecondoChiesto] = useState(false);

  const gestisciErrore = useCallback((err) => {
    if (err instanceof AuthError) {
      sessionExpired();
      navigate("/login", { replace: true });
      return;
    }
    setErrore(err.message || "Operazione non riuscita.");
    avvisa(err.message || "Operazione non riuscita.", "errore");
  }, [navigate, sessionExpired, avvisa]);

  const carica = useCallback(() => {
    return getIscrizione()
      .then((i) => {
        setIscrizione(i);
        setForm(daIscrizione(i));
        setCaricamento(false);
      })
      .catch((err) => {
        gestisciErrore(err);
        setCaricamento(false);
      });
  }, [gestisciErrore]);

  useEffect(() => { carica(); }, [carica]);

  const salva = async (evento) => {
    evento.preventDefault();
    setErrore("");
    setSalvataggio(true);

    try {
      const aggiornata = await salvaIscrizione({ ...form });
      setIscrizione(aggiornata);
      setForm(daIscrizione(aggiornata));
      avvisa("Contatti salvati.");
    } catch (err) {
      gestisciErrore(err);
    } finally {
      setSalvataggio(false);
    }
  };

  if (caricamento) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Carico i tuoi contatti…</p>
      </div>
    );
  }

  const originale = iscrizione ? daIscrizione(iscrizione) : VUOTO;
  const sporco = Object.keys(VUOTO).some((c) => (form[c] ?? "") !== (originale[c] ?? ""));

  /* Minorenne si sa dalla data di nascita, che si scrive nell'iscrizione: da
     qui non si tocca, ma decide quali di questi campi sono obbligatori. */
  const minore = minorenne(iscrizione?.dataNascita);

  const mostraSecondo = secondoChiesto
    || CAMPI_CONTATTO.some((c) => form[`tutore2${c.suffisso}`]);

  /* Toglierlo vuol dire svuotarlo, non solo nasconderlo: un numero che resta
     scritto senza che nessuno lo veda è un numero che un giorno qualcuno
     chiama. */
  const togliSecondo = () => {
    setSecondoChiesto(false);
    setForm({
      ...form,
      tutore2Nome: "", tutore2Parentela: "",
      tutore2Telefono: "", tutore2Email: ""
    });
  };

  const mancaTelefono = !form.telefono;
  const mancaTutore = minore && (!form.tutoreNome || !form.tutoreTelefono);

  return (
    <div className="adm-page adm-editor-page">
      <div className="adm-page-head">
        <div className="adm-head-left">
          <h1 className="adm-page-title">I tuoi contatti</h1>
          <p className="adm-page-sub">
            Come ti si raggiunge, e chi si chiama se succede qualcosa in
            allenamento.
          </p>
        </div>

        {(sporco || salvataggio) && (
          <div className="adm-head-actions">
            <button
              type="submit"
              form="modulo-contatti"
              className="adm-btn adm-btn-primary"
              disabled={salvataggio}
            >
              <FaSave /> {salvataggio ? "Salvataggio…" : "Salva le modifiche"}
            </button>
          </div>
        )}
      </div>

      {errore && (
        <div className="adm-alert adm-alert-error" role="alert">
          <FaExclamationCircle /> <span>{errore}</span>
        </div>
      )}

      {(mancaTelefono || mancaTutore) && (
        <div className="adm-alert adm-alert-info">
          <FaInfoCircle />
          <span>
            Per completare l&apos;iscrizione manca ancora{" "}
            <strong>
              {[
                mancaTelefono && "un numero di telefono",
                mancaTutore && "il contatto di un genitore"
              ].filter(Boolean).join(" e ")}
            </strong>.
          </span>
        </div>
      )}

      <form id="modulo-contatti" onSubmit={salva}>
        <div className="isc-colonna">
          <section className="adm-panel">
            <h2 className="adm-panel-title">
              <FaPhoneAlt aria-hidden="true" /> Contatti
            </h2>

            <fieldset className="adm-gruppo">
              <legend className="adm-gruppo-titolo">I tuoi recapiti</legend>

              <div className="adm-campi">
                <label className="adm-field">
                  <span className="adm-label">
                    Cellulare
                    <span className="adm-obbligatorio" title="Serve per completare l'iscrizione">*</span>
                  </span>
                  <input
                    type="tel"
                    className="adm-input"
                    value={form.telefono}
                    maxLength={40}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    disabled={salvataggio}
                  />
                </label>

                {/* L'email sta sull'account e non sulla scheda: si cambia dal
                    profilo, perché è anche il modo con cui si entra nel
                    sito. Qui si legge, insieme al telefono, che è dove la si
                    cerca. */}
                <label className="adm-field">
                  <span className="adm-label">Email</span>
                  <input
                    type="email"
                    className="adm-input"
                    value={user?.email ?? ""}
                    readOnly
                    disabled
                  />
                  <span className="adm-hint">
                    È l&apos;indirizzo con cui entri: si cambia da <em>Profilo</em>.
                  </span>
                </label>
              </div>
            </fieldset>

            <fieldset className="adm-gruppo">
              <legend className="adm-gruppo-titolo">Chi chiamare se serve</legend>
              <p className="adm-hint" style={{ marginTop: 0 }}>
                {minore
                  ? "Hai meno di diciotto anni: nome e telefono di un adulto servono per completare l'iscrizione."
                  : "Non è obbligatorio, ma è il primo numero che si cerca quando succede qualcosa."}
              </p>

              {CONTATTI.map((contatto, indice) => {
                if (indice > 0 && !mostraSecondo) return null;

                return (
                  <div className="isc-contatto" key={contatto.prefisso}>
                    <div className="isc-contatto-testa">
                      <span className="isc-contatto-titolo">{contatto.titolo}</span>

                      {indice > 0 && (
                        <button
                          type="button"
                          className="isc-togli"
                          onClick={togliSecondo}
                          disabled={salvataggio}
                        >
                          <FaTimes aria-hidden="true" /> Togli
                        </button>
                      )}
                    </div>

                    <div className="adm-campi">
                      {CAMPI_CONTATTO.map((c) => {
                        const chiave = `${contatto.prefisso}${c.suffisso}`;

                        /* L'asterisco solo sul primo: il secondo è un di più,
                           e un obbligo che compare quando si apre qualcosa di
                           facoltativo è una trappola. */
                        const richiesto = minore && indice === 0 && c.seMinore;

                        return (
                          <label className="adm-field" key={chiave}>
                            <span className="adm-label">
                              {c.etichetta}
                              {richiesto && (
                                <span className="adm-obbligatorio" title="Serve per completare l'iscrizione">*</span>
                              )}
                            </span>

                            {c.tipo === "scelta" ? (
                              <Tendina
                                valore={form[chiave]}
                                onChange={(v) => setForm({ ...form, [chiave]: v })}
                                opzioni={OPZIONI_PARENTELA}
                                disabilitato={salvataggio}
                                etichettaAria={`${c.etichetta} (${contatto.titolo})`}
                                segnaposto="Scegli…"
                              />
                            ) : (
                              <input
                                type={c.tipo ?? "text"}
                                className="adm-input"
                                value={form[chiave]}
                                maxLength={c.max}
                                onChange={(e) => setForm({ ...form, [chiave]: e.target.value })}
                                disabled={salvataggio}
                                aria-label={`${c.etichetta} (${contatto.titolo})`}
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {!mostraSecondo && (
                <button
                  type="button"
                  className="adm-btn adm-btn-ghost isc-aggiungi"
                  onClick={() => setSecondoChiesto(true)}
                  disabled={salvataggio}
                >
                  <FaPlus aria-hidden="true" /> Aggiungi un altro contatto
                </button>
              )}
            </fieldset>
          </section>
        </div>
      </form>
    </div>
  );
}
