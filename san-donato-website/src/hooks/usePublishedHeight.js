import { useEffect, useRef } from "react";

/**
 * Misura l'altezza di un elemento e la pubblica come variabile CSS globale.
 *
 * Serve alla prima schermata della home: l'intestazione (contatti + hero +
 * navbar) cambia altezza al variare della larghezza, del font e
 * dell'orientamento, e non è calcolabile in CSS. Pubblicandola come variabile,
 * la sezione sottostante può occupare esattamente lo spazio che resta.
 */
export function usePublishedHeight(cssVariable) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const root = document.documentElement;

    const publish = () => {
      const height = Math.round(node.getBoundingClientRect().height);
      root.style.setProperty(cssVariable, `${height}px`);
    };

    publish();

    // ResizeObserver copre anche i cambi dovuti al caricamento dei font
    // e al riflusso della navbar, che un listener su resize si perderebbe.
    const observer = new ResizeObserver(publish);
    observer.observe(node);

    window.addEventListener("orientationchange", publish);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", publish);
      root.style.removeProperty(cssVariable);
    };
  }, [cssVariable]);

  return ref;
}
