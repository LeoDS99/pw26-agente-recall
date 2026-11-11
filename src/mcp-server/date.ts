// Calcoli sulle date usati dai tool che lavorano su un intervallo "dal" - "al".

import { ErroreDominio } from "../backend/ErroreDominio.js";

// Se manca la data finale, l'intervallo copre i 30 giorni dopo "dal".
export const GIORNI_PREDEFINITI = 30;

// Restituisce la data finale dell'intervallo: quella indicata oppure, se manca,
// 30 giorni dopo "dal". Un intervallo al contrario è un errore di dominio: con
// un elenco vuoto il modello direbbe "non c'è niente", che sarebbe falso.
export function dataFinale(dal: string, al?: string): string {
  const fine = al ?? giorniDopo(dal, GIORNI_PREDEFINITI);
  if (fine < dal) {
    throw new ErroreDominio(`La data finale (${fine}) viene prima di quella iniziale (${dal}).`);
  }
  return fine;
}

// "2026-11-12" più 30 giorni = "2026-12-12"
function giorniDopo(data: string, giorni: number): string {
  const d = new Date(data); // una data senza orario è letta come UTC
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10); // di nuovo AAAA-MM-GG
}
