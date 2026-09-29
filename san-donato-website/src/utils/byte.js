/**
 * Byte in una forma che si legge: 10936443 → "10,4 MB".
 *
 * Base 1024, come i pannelli di Neon e Cloudflare: il numero della scheda
 * Spese sito deve essere lo stesso che si trova aprendo il pannello.
 */
const UNITA = ["byte", "KB", "MB", "GB", "TB"];

export function byteLeggibili(byte) {
  if (byte == null || !Number.isFinite(byte)) return "—";
  let valore = byte;
  let i = 0;
  while (valore >= 1024 && i < UNITA.length - 1) {
    valore /= 1024;
    i += 1;
  }
  const cifre = i === 0 || valore >= 100 ? 0 : 1;
  return `${valore.toLocaleString("it-IT", { maximumFractionDigits: cifre })} ${UNITA[i]}`;
}
