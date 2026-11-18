// OllamaProvider: implementazione di ModelProvider per i modelli eseguiti in
// locale con Ollama. Usa la libreria client ufficiale di Ollama, solo per la
// singola chiamata al modello: il ciclo agentico non è qui, è in Agent.

import { Ollama, type Message, type Tool } from "ollama";
import type { ModelProvider } from "./ModelProvider.ts";
import type { ChiamataTool, Messaggio, RispostaModello, SpecTool, UsoToken } from "./tipi.ts";

export interface OpzioniOllama {
  host: string; // indirizzo del server di Ollama
  contesto: number; // token di contesto (num_ctx): istruzioni, tool e conversazione
  maxTokenRisposta: number; // tetto ai token generati in una risposta (num_predict)
}

// Il contesto predefinito di Ollama è di 4096 token: le sole descrizioni dei
// sei tool ne occupano circa 1.800, e quando il contesto finisce Ollama taglia
// l'inizio della conversazione senza avvisare. Per questo lo alziamo.
// 2048 max token, perché il modello non deve generare risposte troppo lunghe.
const OPZIONI_PREDEFINITE: OpzioniOllama = { host: "http://127.0.0.1:11434", contesto: 16384, maxTokenRisposta: 2048 };

export class OllamaProvider implements ModelProvider {
  readonly nome: string;
  private readonly client: Ollama;
  private readonly modello: string;
  private readonly contesto: number;
  private readonly maxTokenRisposta: number;

  constructor(modello: string, opzioni: Partial<OpzioniOllama> = {}) {
    const { host, contesto, maxTokenRisposta } = { ...OPZIONI_PREDEFINITE, ...opzioni };
    this.modello = modello;
    this.contesto = contesto;
    this.maxTokenRisposta = maxTokenRisposta;
    this.client = new Ollama({ host });
    this.nome = `ollama/${modello}`;
  }

  async chat(messaggi: Messaggio[], tools: SpecTool[]): Promise<RispostaModello> {
    const inizio = Date.now();
    // La risposta arriva a pezzi (stream): così la connessione resta attiva
    // anche quando il modello impiega minuti. Con una risposta unica il fetch
    // di Node chiude la connessione dopo 5 minuti di attesa (trovato nel giro
    // ufficiale degli scenari).
    const pezzi = await this.client.chat({
      model: this.modello,
      messages: messaggi.map(versoOllama),
      tools: tools.map(toolPerOllama),
      stream: true,
      // Niente ragionamento: alcuni modelli (per esempio Gemma 4) prima di
      // rispondere "pensano" a lungo, e sul processore costa minuti a ogni
      // giro. Sui modelli che non ragionano l'opzione non cambia niente.
      think: false,
      // temperature 0: a parità di richiesta il modello sceglie sempre le stesse
      // parole, così gli scenari di test sono ripetibili.
      // num_predict: senza il timeout, un modello che non smette di generare
      // bloccherebbe l'agente; il tetto lo ferma.
      options: { num_ctx: this.contesto, temperature: 0, num_predict: this.maxTokenRisposta },
    });

    // Si ricompone la risposta: il testo si concatena, le chiamate ai tool si
    // raccolgono, i token si leggono dall'ultimo pezzo (done = true).
    let testo = "";
    const chiamate: ChiamataTool[] = [];
    const token: UsoToken = { ingresso: 0, uscita: 0 };
    for await (const pezzo of pezzi) {
      testo += pezzo.message.content;
      for (const c of pezzo.message.tool_calls ?? []) {
        chiamate.push({ nome: c.function.name, argomenti: c.function.arguments });
      }
      if (pezzo.done) {
        token.ingresso = pezzo.prompt_eval_count;
        token.uscita = pezzo.eval_count;
      }
    }

    return { testo, chiamate, token, durataMs: Date.now() - inizio };
  }
}

// Da un messaggio dell'harness al formato di Ollama.
function versoOllama(m: Messaggio): Message {
  switch (m.ruolo) {
    case "sistema":
      return { role: "system", content: m.testo };
    case "utente":
      return { role: "user", content: m.testo };
    case "modello":
      return {
        role: "assistant",
        content: m.testo,
        tool_calls: m.chiamate.map((c) => ({ function: { name: c.nome, arguments: c.argomenti } })),
      };
    case "tool":
      return { role: "tool", tool_name: m.nomeTool, content: m.testo };
  }
}

// Da un tool del server MCP al formato di Ollama. Lo schema dei parametri è
// già un JSON Schema: si passa così com'è.
function toolPerOllama(t: SpecTool): Tool {
  return {
    type: "function",
    function: {
      name: t.nome,
      description: t.descrizione,
      parameters: t.schemaInput as NonNullable<Tool["function"]["parameters"]>,
    },
  };
}
