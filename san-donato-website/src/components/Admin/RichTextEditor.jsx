import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  FaBold, FaItalic, FaListUl, FaListOl, FaQuoteRight,
  FaLink, FaUnlink, FaUndo, FaRedo, FaHeading, FaParagraph
} from "react-icons/fa";
import { useDialoghi } from "../../context/dialoghi";

/**
 * Un pulsante della barra strumenti.
 * Definito fuori dal componente: creato dentro il render, React lo tratterebbe
 * come un tipo nuovo a ogni battuta e rimonterebbe la barra ogni volta.
 */
function ToolButton({ onClick, active, label, children, disabled, enabled = true }) {
  return (
    <button
      type="button"
      className={`adm-tool ${active ? "is-active" : ""}`}
      onClick={onClick}
      disabled={disabled || !enabled}
      title={label}
      aria-label={label}
      aria-pressed={!!active}
    >
      {children}
    </button>
  );
}

/**
 * Editor del corpo della notizia.
 *
 * Produce HTML, lo stesso formato che WordPress già salva nei post esistenti:
 * così le 96 notizie di archivio restano modificabili senza conversioni.
 */
export default function RichTextEditor({ value, onChange, onNormalizzato, disabled }) {
  const { chiediTesto } = useDialoghi();

  // La richiamata in un ref: serve dentro a un effetto che deve scattare una
  // volta sola per istanza dell'editor, e metterla fra le dipendenze lo
  // farebbe ripartire a ogni render del componente che la passa.
  const normalizzato = useRef(onNormalizzato);

  // L'aggiornamento sta in un effetto e non nel corpo del componente: toccare
  // un ref durante il render è una scrittura che React non vede.
  useEffect(() => { normalizzato.current = onNormalizzato; }, [onNormalizzato]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Il titolo della notizia è un campo a parte: dentro al corpo
        // servono solo i sottotitoli.
        link: false
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" }
      })
    ],
    content: value || "",
    editable: !disabled,
    onUpdate: ({ editor: instance }) => {
      const html = instance.getHTML();
      // TipTap rappresenta il documento vuoto come un paragrafo vuoto:
      // lo normalizziamo, altrimenti un campo "vuoto" risulterebbe compilato.
      const pulito = html === "<p></p>" ? "" : html;

      /**
       * Se il testo cambia mentre l'editor non ha il fuoco, non è stata una
       * persona: è l'editor che sistema il documento per conto suo — chiude i
       * tag lasciati aperti, butta quelli che non conosce, trasforma in
       * collegamenti gli indirizzi scritti a mano. Succede appena il
       * contenuto entra, e a volte un istante dopo.
       *
       * Va detto a chi ci sta sopra, altrimenti quella riscrittura viene
       * contata come una modifica e uscire dalla pagina chiede conferma a chi
       * non ha toccato niente. Per scrivere qualcosa bisogna prima cliccarci
       * dentro, quindi il fuoco è il modo più affidabile di distinguere le due.
       */
      if (!instance.isFocused) {
        normalizzato.current?.(pulito);
        return;
      }

      onChange(pulito);
    },
    editorProps: {
      attributes: {
        class: "adm-editor-surface",
        "aria-label": "Corpo della notizia"
      }
    }
  });

  /**
   * Appena l'editor ha analizzato il contenuto iniziale, comunica come lo ha
   * riscritto.
   *
   * TipTap non conserva l'HTML che riceve: lo trasforma nel proprio documento
   * e lo riserializza. Gli a capo fra i paragrafi spariscono, i tag che non
   * conosce vengono buttati, quelli aperti e mai chiusi vengono chiusi, e
   * l'autolink trasforma in collegamenti gli indirizzi scritti a mano. Per le
   * notizie che arrivano da WordPress la stringa che esce non è quasi mai
   * identica a quella entrata.
   *
   * Senza questo passaggio, confrontare il modulo con ciò che è stato
   * caricato per capire se ci sono modifiche risponde sempre di sì, e uscire
   * dall'editor chiede conferma anche a chi non ha toccato niente. Qui
   * l'editor dichiara la propria versione del testo, e chi lo usa la prende
   * come punto di partenza invece che come modifica.
   */
  useEffect(() => {
    if (!editor) return;
    const html = editor.getHTML();
    normalizzato.current?.(html === "<p></p>" ? "" : html);
  }, [editor]);

  // Il contenuto arriva in modo asincrono quando si modifica una notizia
  // esistente: va riversato nell'editor una volta caricato.
  useEffect(() => {
    if (!editor) return;
    const incoming = value || "";
    if (incoming !== editor.getHTML() && incoming !== "") {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value === undefined]);

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) {
    return <div className="adm-editor-loading">Caricamento dell&apos;editor…</div>;
  }

  const setLink = async () => {
    const precedente = editor.getAttributes("link").href || "";

    const url = await chiediTesto({
      titolo: precedente ? "Cambia il collegamento" : "Inserisci un collegamento",
      testo: "Lascia il campo vuoto e conferma per togliere il collegamento.",
      etichetta: "Indirizzo",
      segnaposto: "https://…",
      valoreIniziale: precedente,
      conferma: "Applica",
      monolinea: true,
      massimo: 500
    });

    if (url === null) return;               // annullato
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    // Chi incolla un indirizzo spesso lo scrive senza "https://": senza
    // questa riga il collegamento verrebbe letto come un percorso del sito.
    const normalizzato = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizzato }).run();
  };


  return (
    <div className={`adm-editor ${disabled ? "is-disabled" : ""}`}>
      <div className="adm-toolbar-editor" role="toolbar" aria-label="Formattazione">
        <ToolButton disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          label="Grassetto"
        ><FaBold /></ToolButton>

        <ToolButton disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          label="Corsivo"
        ><FaItalic /></ToolButton>

        <span className="adm-tool-sep" />

        <ToolButton disabled={disabled}
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph")}
          label="Testo normale"
        ><FaParagraph /></ToolButton>

        <ToolButton disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          label="Sottotitolo"
        ><FaHeading /></ToolButton>

        <span className="adm-tool-sep" />

        <ToolButton disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          label="Elenco puntato"
        ><FaListUl /></ToolButton>

        <ToolButton disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          label="Elenco numerato"
        ><FaListOl /></ToolButton>

        <ToolButton disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          label="Citazione"
        ><FaQuoteRight /></ToolButton>

        <span className="adm-tool-sep" />

        <ToolButton disabled={disabled} onClick={setLink} active={editor.isActive("link")} label="Inserisci collegamento">
          <FaLink />
        </ToolButton>

        <ToolButton disabled={disabled}
          onClick={() => editor.chain().focus().unsetLink().run()}
          label="Rimuovi collegamento"
          enabled={editor.isActive("link")}
        ><FaUnlink /></ToolButton>

        <span className="adm-tool-sep adm-tool-sep-grow" />

        <ToolButton disabled={disabled}
          onClick={() => editor.chain().focus().undo().run()}
          label="Annulla"
          enabled={editor.can().undo()}
        ><FaUndo /></ToolButton>

        <ToolButton disabled={disabled}
          onClick={() => editor.chain().focus().redo().run()}
          label="Ripeti"
          enabled={editor.can().redo()}
        ><FaRedo /></ToolButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
