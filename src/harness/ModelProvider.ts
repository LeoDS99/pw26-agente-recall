// ModelProvider: il livello di astrazione dal fornitore del modello.
// L'harness parla con il modello solo attraverso questa interfaccia: per usare
// un altro modello o un altro fornitore basta scrivere un'altra classe che la
// implementa, senza toccare il resto del codice (requisito dell'allegato).

import type { Messaggio, RispostaModello, SpecTool } from "./tipi.js";

export interface ModelProvider {
  // Nome del modello, per esempio "ollama/qwen3:4b-instruct": finisce nel log.
  readonly nome: string;

  // Manda al modello la conversazione e l'elenco dei tool, e restituisce la sua
  // risposta: un testo finale oppure una o più chiamate a tool.
  chat(messaggi: Messaggio[], tools: SpecTool[]): Promise<RispostaModello>;
}
