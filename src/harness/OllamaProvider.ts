// OllamaProvider: implementazione di ModelProvider per i modelli eseguiti in
// locale con Ollama. Usa la libreria client ufficiale di Ollama, solo per la
// singola chiamata al modello: il ciclo agentico non è qui, è in Agent.

import { Ollama, type Message, type Tool } from "ollama";
import type { ModelProvider } from "./ModelProvider.js";
import type { Messaggio, RispostaModello, SpecTool } from "./tipi.js";

export interface OpzioniOllama {
  host: string; // indirizzo del server di Ollama
  contesto: number; // token di contesto (num_ctx): istruzioni, tool e conversazione
}

// Il contesto predefinito di Ollama è di 4096 token: le sole descrizioni dei
// sei tool ne occupano circa 1.800, e quando il contesto finisce Ollama taglia
// l'inizio della conversazione senza avvisare. Per questo lo alziamo.
const OPZIONI_PREDEFINITE: OpzioniOllama = { host: "http://127.0.0.1:11434", contesto: 16384 };

export class OllamaProvider implements ModelProvider {
  readonly nome: string;
  private readonly client: Ollama;
  private readonly modello: string;
  private readonly contesto: number;

  constructor(modello: string, opzioni: Partial<OpzioniOllama> = {}) {
    const { host, contesto } = { ...OPZIONI_PREDEFINITE, ...opzioni };
    this.modello = modello;
    this.contesto = contesto;
    this.client = new Ollama({ host });
    this.nome = `ollama/${modello}`;
  }

  async chat(messaggi: Messaggio[], tools: SpecTool[]): Promise<RispostaModello> {
    const inizio = Date.now();
    const risposta = await this.client.chat({
      model: this.modello,
      messages: messaggi.map(versoOllama),
      tools: tools.map(toolPerOllama),
      stream: false,
      // temperature 0: a parità di richiesta il modello sceglie sempre le stesse
      // parole, così gli scenari di test sono ripetibili.
      options: { num_ctx: this.contesto, temperature: 0 },
    });

    return {
      testo: risposta.message.content,
      chiamate: (risposta.message.tool_calls ?? []).map((c) => ({
        nome: c.function.name,
        argomenti: c.function.arguments,
      })),
      token: { ingresso: risposta.prompt_eval_count, uscita: risposta.eval_count },
      durataMs: Date.now() - inizio,
    };
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
