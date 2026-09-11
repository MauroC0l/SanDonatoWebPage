import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  FaBold, FaItalic, FaListUl, FaListOl, FaQuoteRight,
  FaLink, FaUnlink, FaUndo, FaRedo, FaHeading, FaParagraph
} from "react-icons/fa";

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
export default function RichTextEditor({ value, onChange, disabled }) {
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
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class: "adm-editor-surface",
        "aria-label": "Corpo della notizia"
      }
    }
  });

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

  const setLink = () => {
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("Indirizzo del collegamento:", previous);

    if (url === null) return;               // annullato
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    const normalized = /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
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
