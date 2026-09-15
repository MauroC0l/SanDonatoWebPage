import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/*
      * Le due novità della versione 7 accese fin da adesso.
      *
      * React Router le annuncia con un avviso in console a ogni avvio, e un
      * avviso che compare sempre è un avviso che si smette di leggere —
      * insieme a tutti gli altri che compariranno dopo.
      *
      * v7_startTransition: gli aggiornamenti di rotta passano da
      *   startTransition, quindi la navigazione non blocca la pagina mentre
      *   una schermata pigra si carica.
      * v7_relativeSplatPath: dentro a una rotta con "*" i collegamenti
      *   relativi si risolvono rispetto alla rotta e non al pezzo catturato.
      *   Qui riguarda /admin/*, /coach/* e le altre aree.
      */}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
