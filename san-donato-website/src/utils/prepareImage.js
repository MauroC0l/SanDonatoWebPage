// Ridimensiona le immagini prima del caricamento.
//
// Le foto scattate col telefono arrivano da 4-5 MB e con l'orientamento scritto
// nei metadati EXIF: caricate così saturano lo spazio del server e sul sito
// compaiono ruotate. Qui vengono riportate a una misura ragionevole e
// raddrizzate una volta per tutte.

const MAX_EDGE = 1600;      // lato lungo massimo, in pixel
const JPEG_QUALITY = 0.85;
const SKIP_BELOW_BYTES = 400 * 1024;

// Formati fotografici accettati. È un elenco chiuso, non "image/*":
// un SVG è un documento che può contenere script, e caricato nella libreria
// media verrebbe servito dallo stesso dominio del sito.
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

// Formati che non ha senso (o non si può) ricomprimere
const PASSTHROUGH = new Set(["image/gif"]);

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function prepareImage(file) {
  if (!file) throw new Error("Nessun file selezionato.");

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Formato non supportato. Usa una foto JPG, PNG, WEBP o GIF.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `L'immagine pesa ${formatSize(file.size)}: il limite è ${formatSize(MAX_UPLOAD_BYTES)}.`
    );
  }

  if (PASSTHROUGH.has(file.type)) return file;

  let bitmap;
  try {
    // imageOrientation: raddrizza in base ai metadati EXIF
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Se il browser non riesce a decodificarla, la lasciamo passare intatta:
    // meglio un caricamento pesante che un caricamento impossibile.
    return file;
  }

  const { width, height } = bitmap;
  const longestEdge = Math.max(width, height);
  const needsResize = longestEdge > MAX_EDGE;

  // Già piccola e leggera: non la tocchiamo, evitando una ricompressione inutile
  if (!needsResize && file.size < SKIP_BELOW_BYTES) {
    bitmap.close?.();
    return file;
  }

  const scale = needsResize ? MAX_EDGE / longestEdge : 1;
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close?.();

  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );

  if (!blob) return file;

  // Se la conversione non ha guadagnato niente, teniamo l'originale
  if (blob.size >= file.size && !needsResize) return file;

  return new File([blob], replaceExtension(file.name, "jpg"), {
    type: "image/jpeg",
    lastModified: Date.now()
  });
}

function replaceExtension(name = "immagine", extension) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return `${base}.${extension}`;
}

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
