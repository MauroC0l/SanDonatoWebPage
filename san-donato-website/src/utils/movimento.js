/**
 * I movimenti del sito pubblico, in un posto solo.
 *
 * Ogni pagina li usa con un attributo, senza importare niente:
 *
 *   data-rivela                 compare salendo quando entra nello schermo
 *   data-rivela="sinistra"      … arrivando da sinistra ("destra", "zoom",
 *                               "sfuma" per la sola dissolvenza)
 *   data-rivela-gruppo          i figli diretti compaiono uno dopo l'altro
 *   data-parallasse="0.15"      scorre più lento della pagina (0-0.5)
 *   data-inclina                si inclina in 3D seguendo il puntatore
 *   data-magnete                un pulsante che si lascia "attirare" dal
 *                               puntatore, di pochi pixel
 *
 * PERCHÉ NON UNA LIBRERIA. Framer Motion o GSAP pesano decine di kilobyte
 * sul pacchetto che scarica chiunque apra la home, per fare cose che il
 * browser sa già fare: IntersectionObserver decide quando, il CSS anima.
 * Qui c'è solo chi osserva e chi mette le classi.
 *
 * CHI HA CHIESTO MENO MOVIMENTO non ne vede nessuno: con
 * prefers-reduced-motion tutto è subito al suo posto e fermo. Lo stesso
 * senza JavaScript, perché lo stato "nascosto" esiste solo quando la
 * classe .mv-attivo è sull'html, e la mette questo file.
 *
 * Le pagine cambiano senza ricaricare: un MutationObserver trova gli
 * elementi nuovi appena React li mette nel documento.
 */

const RIDOTTO = "(prefers-reduced-motion: reduce)";
const PUNTATORE_FINE = "(hover: hover) and (pointer: fine)";

let avviato = false;

export function avviaMovimento() {
  if (avviato || typeof window === "undefined") return;
  avviato = true;

  if (window.matchMedia(RIDOTTO).matches) return;
  document.documentElement.classList.add("mv-attivo");

  /* ---------- Comparsa allo scorrimento ---------- */

  const osservatore = new IntersectionObserver((voci) => {
    for (const v of voci) {
      if (!v.isIntersecting) continue;
      v.target.classList.add("mv-visto");
      osservatore.unobserve(v.target);
    }
  /* Basta che il bordo di sopra entri nello schermo: con una soglia in
     percentuale, un elemento più alto dello schermo (un testo lungo) non la
     raggiungeva mai e restava invisibile. */
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });

  const prepara = (radice) => {
    radice.querySelectorAll?.("[data-rivela]:not(.mv-osservato)").forEach((el) => {
      el.classList.add("mv-osservato");
      osservatore.observe(el);
    });
    /* I figli di un gruppo compaiono in fila: il ritardo sta in una
       variabile CSS, così ogni elemento lo legge per conto suo. */
    radice.querySelectorAll?.("[data-rivela-gruppo]:not(.mv-osservato)").forEach((gruppo) => {
      gruppo.classList.add("mv-osservato");
      [...gruppo.children].forEach((figlio, i) => {
        figlio.style.setProperty("--mv-ritardo", `${Math.min(i, 12) * 70}ms`);
        if (!figlio.hasAttribute("data-rivela")) figlio.setAttribute("data-rivela", "");
        if (!figlio.classList.contains("mv-osservato")) {
          figlio.classList.add("mv-osservato");
          osservatore.observe(figlio);
        }
      });
    });
    radice.querySelectorAll?.("[data-parallasse]:not(.mv-par)").forEach((el) => {
      el.classList.add("mv-par");
      parallassi.add(el);
    });
    if (window.matchMedia(PUNTATORE_FINE).matches) {
      radice.querySelectorAll?.("[data-inclina]:not(.mv-incl)").forEach(inclina);
      radice.querySelectorAll?.("[data-magnete]:not(.mv-magn)").forEach(magnete);
    }
  };

  /* ---------- Parallasse ---------- */

  const parallassi = new Set();
  let inAttesa = false;
  const aggiornaParallassi = () => {
    inAttesa = false;
    const alto = window.innerHeight;
    for (const el of parallassi) {
      if (!el.isConnected) { parallassi.delete(el); continue; }
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > alto + 200) continue;
      const forza = Math.min(0.5, Math.max(0, Number(el.dataset.parallasse) || 0.15));
      // Zero quando l'elemento è a metà schermo, e cresce allontanandosi
      const scarto = (r.top + r.height / 2 - alto / 2) * forza * -1;
      el.style.setProperty("--mv-parallasse", `${scarto.toFixed(1)}px`);
    }
  };
  const suScorrimento = () => {
    if (inAttesa) return;
    inAttesa = true;
    requestAnimationFrame(aggiornaParallassi);
  };
  window.addEventListener("scroll", suScorrimento, { passive: true });
  window.addEventListener("resize", suScorrimento, { passive: true });

  /* ---------- Inclinazione 3D e pulsanti magnetici ---------- */

  function inclina(el) {
    el.classList.add("mv-incl");
    const massimo = Number(el.dataset.inclina) || 7;
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--mv-rx", `${(-y * massimo).toFixed(2)}deg`);
      el.style.setProperty("--mv-ry", `${(x * massimo).toFixed(2)}deg`);
      // La luce segue il puntatore: una lucentezza che scorre sulla scheda
      el.style.setProperty("--mv-luce-x", `${((x + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--mv-luce-y", `${((y + 0.5) * 100).toFixed(1)}%`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--mv-rx", "0deg");
      el.style.setProperty("--mv-ry", "0deg");
    });
  }

  function magnete(el) {
    el.classList.add("mv-magn");
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.setProperty("--mv-mx", `${(x * 0.18).toFixed(1)}px`);
      el.style.setProperty("--mv-my", `${(y * 0.25).toFixed(1)}px`);
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--mv-mx", "0px");
      el.style.setProperty("--mv-my", "0px");
    });
  }

  /* ---------- Elementi che arrivano dopo ---------- */

  prepara(document);
  new MutationObserver((cambi) => {
    for (const c of cambi) {
      for (const n of c.addedNodes) {
        if (n.nodeType !== 1) continue;
        // L'elemento stesso e tutto quello che contiene
        const involucro = { querySelectorAll: (sel) => [...(n.matches?.(sel) ? [n] : []), ...n.querySelectorAll(sel)] };
        prepara(involucro);
      }
    }
    suScorrimento();
  }).observe(document.body, { childList: true, subtree: true });
  suScorrimento();
}
