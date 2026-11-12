// Agent: il ciclo agentico dell'harness.
// Riceve una richiesta dell'operatore e la porta a termine: interroga il
// modello, esegue i tool che il modello chiede, gli restituisce i risultati e
// ripete, finché il modello risponde senza chiedere altri tool.

import type { McpToolClient } from "./McpToolClient.js";
import type { ModelProvider } from "./ModelProvider.js";
import type { ChiamataTool, EsitoAgente, Messaggio, SpecTool, UsoToken } from "./tipi.js";

export class Agent {
  private readonly modello: ModelProvider; // il modello, dietro l'astrazione dal fornitore
  private readonly mcp: McpToolClient; // il collegamento al server MCP
  private readonly promptDiSistema: string; // le istruzioni fisse per il modello
  private readonly maxIterazioni: number; // numero massimo di giri del ciclo

  constructor(modello: ModelProvider, mcp: McpToolClient, promptDiSistema: string, maxIterazioni = 12) {
    this.modello = modello;
    this.mcp = mcp;
    this.promptDiSistema = promptDiSistema;
    this.maxIterazioni = maxIterazioni;
  }

  // Esegue una richiesta dell'operatore e restituisce l'esito: la risposta,
  // il motivo per cui il ciclo si è fermato, i giri fatti e i token consumati.
  async esegui(richiesta: string): Promise<EsitoAgente> {
    // I tool disponibili si chiedono al server: il modello può usare solo questi.
    const tools = await this.mcp.elencaTool();

    // La conversazione parte con due messaggi: le istruzioni (sistema) e la
    // richiesta dell'operatore (utente). Il modello non ha memoria: a ogni giro
    // riceve tutta la lista, che cresce con le sue risposte e con i risultati
    // dei tool.
    const messaggi: Messaggio[] = [
      { ruolo: "sistema", testo: this.promptDiSistema },
      { ruolo: "utente", testo: richiesta },
    ];

    // Somma dei token di tutti i giri: serve per la stima dei costi.
    const tokenTotali: UsoToken = { ingresso: 0, uscita: 0 };

    // Il ciclo agentico: ogni giro è una chiamata al modello. Il limite di giri
    // ferma un modello che continua a chiedere tool senza arrivare a una risposta.
    for (let iterazione = 1; iterazione <= this.maxIterazioni; iterazione++) {
      // Il modello riceve tutta la conversazione e l'elenco dei tool.
      const risposta = await this.modello.chat(messaggi, tools);

      const { ingresso, uscita } = risposta.token;
      tokenTotali.ingresso += ingresso;
      tokenTotali.uscita += uscita;

      // Condizione di arresto: se il modello non chiede tool, il suo testo è la
      // risposta finale per l'operatore.
      if (risposta.chiamate.length === 0) {
        return {
          risposta: risposta.testo,
          motivo: "risposta_finale",
          iterazioni: iterazione,
          token: tokenTotali,
        };
      }

      // Altrimenti il modello ha chiesto uno o più tool. La sua risposta entra
      // nella conversazione, così al prossimo giro sa che cosa aveva chiesto.
      messaggi.push({ ruolo: "modello", testo: risposta.testo, chiamate: risposta.chiamate });

      // Le chiamate si eseguono una alla volta, nell'ordine deciso dal modello.
      // Il testo di ognuna (risultato o errore) entra nella conversazione come
      // messaggio "tool": il modello lo legge al prossimo giro.
      for (const chiamata of risposta.chiamate) {
        const { nome } = chiamata;
        const esitoTool = await this.eseguiChiamata(chiamata, tools);
        messaggi.push({ ruolo: "tool", nomeTool: nome, testo: esitoTool });
      }
    }

    // Limite di giri raggiunto senza una risposta finale. Il messaggio dice che
    // cosa è successo e avvisa che qualche scrittura potrebbe essere già avvenuta.
    return {
      risposta:
        "Non sono riuscito a completare la richiesta entro il numero massimo di passaggi. " +
        "Alcune operazioni potrebbero essere già state eseguite: controlla prima di riprovare, " +
        "poi riformula la richiesta in modo più preciso.",
      motivo: "max_iterazioni",
      iterazioni: this.maxIterazioni,
      token: tokenTotali,
    };
  }

  // Esegue una chiamata chiesta dal modello e restituisce il testo da ridare al
  // modello: il risultato del tool, oppure il motivo per cui non è stato
  // eseguito. Gli errori che il modello può correggere da solo non diventano
  // eccezioni: tornano come testo, così il modello li legge e riprova.
  private async eseguiChiamata(chiamata: ChiamataTool, tools: SpecTool[]): Promise<string> {
    // Il tool chiesto deve essere tra quelli esposti dal server: un modello può
    // inventarsi un nome.
    const tool: SpecTool | undefined = tools.find((t) => t.nome === chiamata.nome);

    // Tool inesistente: non si chiama niente. Il modello riceve l'avviso con i
    // nomi dei tool disponibili.
    if (!tool) {
      return `Tool ${chiamata.nome} non trovato, i tool disponibili sono: ${tools.map((t) => t.nome).join(", ")}`;
    }

    // Tool valido: si esegue sul server e al modello torna il testo dell'esito
    // (i dati in JSON, oppure il messaggio d'errore del tool).
    const esito = await this.mcp.chiamaTool(chiamata.nome, chiamata.argomenti);
    return esito.testo;
  }
}
