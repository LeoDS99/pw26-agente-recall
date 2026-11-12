// Agent: il ciclo agentico dell'harness.
// Riceve una richiesta dell'operatore e la porta a termine: interroga il
// modello, esegue i tool che il modello chiede, gli restituisce i risultati e
// ripete, finché il modello risponde senza chiedere altri tool.

import type { McpToolClient } from "./McpToolClient.js";
import type { ModelProvider } from "./ModelProvider.js";
import type { EsitoAgente, Messaggio, UsoToken } from "./tipi.js";

export class Agent {
  private readonly modello: ModelProvider;
  private readonly mcp: McpToolClient;
  private readonly promptDiSistema: string;
  private readonly maxIterazioni: number;

  constructor(modello: ModelProvider, mcp: McpToolClient, promptDiSistema: string, maxIterazioni = 12) {
    this.modello = modello;
    this.mcp = mcp;
    this.promptDiSistema = promptDiSistema;
    this.maxIterazioni = maxIterazioni;
  }

  // Esegue una richiesta dell'operatore e restituisce l'esito.
  async esegui(richiesta: string): Promise<EsitoAgente> {
    // 1. Chiedi al server l'elenco dei tool (this.mcp.elencaTool).

    const tools = await this.mcp.elencaTool();

    // 2. Prepara la lista dei messaggi: sistema e utente.
    const messaggi: Messaggio[] = [
      { ruolo: "sistema", testo: this.promptDiSistema },
      { ruolo: "utente", testo: richiesta },
    ];

    // 3. Prepara il contatore dei token, a zero (tipo UsoToken).
    const tokenTotali: UsoToken = { ingresso: 0, uscita: 0 };
    // 4. Ripeti al massimo maxIterazioni volte:
    for (let iterazione = 1; iterazione <= this.maxIterazioni; iterazione++) {
      //    4a. chiedi al modello (this.modello.chat), passando messaggi e tool;
      const risposta = await this.modello.chat(messaggi, tools);

      //    4b. somma i token della risposta al contatore;
      const { ingresso, uscita } = risposta.token;
      tokenTotali.ingresso += ingresso;
      tokenTotali.uscita += uscita;
      //    4c. se il modello non chiede tool: restituisci l'esito, motivo "risposta_finale";
      if (risposta.chiamate.length === 0) {
        return {
          risposta: risposta.testo,
          motivo: "risposta_finale",
          iterazioni: iterazione,
          token: tokenTotali,
        };
      }
      //    4d. aggiungi ai messaggi la risposta del modello (ruolo "modello");
      messaggi.push({ ruolo: "modello", testo: risposta.testo, chiamate: risposta.chiamate });
      //    4e. per ogni chiamata: esegui il tool (this.mcp.chiamaTool) e aggiungi

      //        ai messaggi il suo risultato (ruolo "tool").
      for (const chiamata of risposta.chiamate) {
        const { nome, argomenti } = chiamata;
        const esitoTool = await this.mcp.chiamaTool(nome, argomenti);
        messaggi.push({ ruolo: "tool", nomeTool: nome, testo: esitoTool.testo });
      }
    }
    //    4e. per ogni chiamata: esegui il tool (this.mcp.chiamaTool) e aggiungi

    //        ai messaggi il suo risultato (ruolo "tool").

    // 5. Se il ciclo finisce senza risposta finale: restituisci l'esito con

    //    motivo "max_iterazioni" e il messaggio onesto per l'operatore.

    return {
      risposta: "Il modello non ha fornito una risposta finale dopo il numero massimo di iterazioni.",
      motivo: "max_iterazioni",
      iterazioni: this.maxIterazioni,
      token: tokenTotali,
    };
  }
}
