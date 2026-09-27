/**
 * Gli indirizzi con cui si abbona il calendario di una squadra.
 *
 * Lo stesso file iCal, detto in tre modi:
 *
 *   - https://…/api/calendario/14.ics   quello da copiare e incollare;
 *   - webcal://…                        su iPhone e Mac apre direttamente
 *                                       Calendario e chiede di abbonarsi;
 *   - calendar.google.com/…?cid=…       apre Google Calendar con la
 *                                       richiesta di abbonamento già pronta.
 *
 * L'identificativo e non il nome della squadra: vedi la nota in
 * server/rotte/calendario/[squadra].js.
 */
export function indirizziCalendario(squadraId, origine = window.location.origin) {
  const https = `${origine}/api/calendario/${squadraId}.ics`;
  const webcal = https.replace(/^https?:/, "webcal:");

  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`
  };
}
