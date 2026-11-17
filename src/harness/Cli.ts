// Cli: l'interfaccia a riga di comando dell'harness.
// Legge le richieste dell'operatore dal terminale, le passa all'Agent e stampa
// le risposte. È anche chi chiede la conferma prima delle scritture: per questo
// implementa ConfermaUtente.

import { stdin, stdout } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import type { Agent } from "./Agent.ts";
import type { ConfermaUtente } from "./ConfermaUtente.ts";
import type { ChiamataTool } from "./tipi.ts";

export class Cli implements ConfermaUtente {
  private readonly terminale: Interface; // legge una riga alla volta dalla tastiera

  constructor() {
    this.terminale = createInterface({ input: stdin, output: stdout });
  }

  // Il dialogo con l'operatore: va avanti finché non scrive "esci".
  async avvia(agente: Agent): Promise<void> {
    console.log(
      "Benvenuto nella chat dell'assistente prenotazioni del Gruppo Sanitario Collemare. Scrivi 'esci' per uscire.",
    );

    while (true) {
      // question stampa il prompt e aspetta che l'operatore prema invio.
      const richiesta = (await this.terminale.question("\n> ")).trim();

      // Una riga vuota non è una richiesta: si torna a chiedere.
      if (richiesta === "") {
        continue;
      }
      if (richiesta === "esci") {
        break;
      }

      const esito = await agente.esegui(richiesta);
      console.log(esito.risposta);
      // Riga di servizio con motivo, giri e token: nelle prove serve per gli
      // screenshot e per confrontare i costi degli scenari.
      console.log(
        `(motivo: ${esito.motivo}, giri: ${esito.iterazioni}, token: ingresso ${esito.token.ingresso}, uscita ${esito.token.uscita})`,
      );
    }
  }

  // ConfermaUtente: mostra la chiamata che il modello vuole eseguire e chiede
  // all'operatore se procedere. Vale come sì solo una risposta esplicita:
  // qualunque altra cosa, anche l'invio a vuoto, vale come no, perché nel dubbio
  // non si scrive.
  async conferma(chiamata: ChiamataTool): Promise<boolean> {
    // L'operatore vede quale tool sta per partire e con quali dati.
    console.log(
      `Il modello vuole eseguire il tool "${chiamata.nome}" con argomenti: ${JSON.stringify(chiamata.argomenti)}`,
    );
    const risposta = await this.terminale.question("Confermi? (s/n) ");
    // trim toglie gli spazi ai lati, toLowerCase rende tutto minuscolo:
    // così "S", " s " e "Sì" valgono tutti come sì.
    const r = risposta.trim().toLowerCase();
    return r === "s" || r === "si" || r === "sì";
  }

  // Un avviso per l'operatore che non passa dal modello, per esempio il server
  // non raggiungibile all'avvio (scenario 12).
  avvisa(testo: string): void {
    console.log(`[avviso] ${testo}`);
  }

  // Chiude la lettura dal terminale: senza, il programma non termina.
  chiudi(): void {
    this.terminale.close();
  }
}
