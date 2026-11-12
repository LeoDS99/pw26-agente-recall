// ConfermaUtente: la conferma umana prima delle scritture (human-in-the-loop).
// L'Agent sa quando serve una conferma, non come si chiede: quello lo decide
// chi implementa questa interfaccia (la riga di comando, o una finta nelle prove).

import type { ChiamataTool } from "./tipi.ts";

export interface ConfermaUtente {
  // Mostra all'operatore la chiamata che il modello vuole eseguire.
  // Restituisce true se l'operatore la approva, false se la rifiuta.
  conferma(chiamata: ChiamataTool): Promise<boolean>;
}
