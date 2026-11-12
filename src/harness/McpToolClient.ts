// McpToolClient: il collegamento tra l'harness e il server MCP.
// Avvolge il Client dell'SDK ufficiale: avvia il server come processo (stdio),
// chiede l'elenco dei tool e li chiama. Non contiene la logica dell'agente:
// decidere quale tool chiamare, e se chiedere conferma, è compito di Agent.

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import type { EsitoTool, SpecTool } from "./tipi.ts";

// Come avviare il server: l'eseguibile e i suoi argomenti.
export interface ComandoServer {
  comando: string;
  argomenti: string[];
}

export class McpToolClient {
  private readonly client: Client;
  private readonly server: ComandoServer;
  private collegato = false; // true solo tra un collegamento riuscito e la chiusura

  constructor(server: ComandoServer) {
    this.server = server;
    this.client = new Client({ name: "harness-recall-collemare", version: "1.0.0" });
  }

  // Avvia il server e si collega. Se il comando è sbagliato o il server non
  // parte, lancia un errore: chi chiama decide cosa fare (scenario 12).
  async connetti(): Promise<void> {
    const trasporto = new StdioClientTransport({ command: this.server.comando, args: this.server.argomenti });
    // Se il server si ferma o la connessione cade, l'SDK ci avvisa qui.
    this.client.onclose = () => {
      this.collegato = false;
    };
    await this.client.connect(trasporto);
    this.collegato = true;
  }

  // Senza collegamento l'SDK non dà errore: restituisce un elenco di tool
  // vuoto. Per l'harness invece è un errore, e va detto in modo esplicito.
  private verificaCollegamento(): void {
    if (!this.collegato) {
      throw new Error("Server MCP non collegato.");
    }
  }

  // L'elenco dei tool esposti dal server, nel formato dell'harness.
  async elencaTool(): Promise<SpecTool[]> {
    this.verificaCollegamento();
    const { tools } = await this.client.listTools();
    return tools.map((t) => ({
      nome: t.name,
      descrizione: t.description ?? "",
      schemaInput: t.inputSchema,
      // Conferma prudente: un tool è di sola lettura solo se il server lo dice
      // esplicitamente. Se l'annotazione manca, l'harness lo tratta come scrittura.
      soloLettura: t.annotations?.readOnlyHint === true,
    }));
  }

  // Chiama un tool e restituisce il testo del risultato.
  // Se il tool risponde con un errore (parametri non validi, regola di dominio,
  // database spento) non lancia eccezioni: torna con errore = true e il testo
  // va comunque al modello. Lancia solo se il tool non esiste (per questo Agent
  // controlla prima l'elenco) o se il collegamento con il server si interrompe.
  async chiamaTool(nome: string, argomenti: Record<string, unknown>): Promise<EsitoTool> {
    this.verificaCollegamento();
    const risultato = await this.client.callTool({ name: nome, arguments: argomenti });
    const testo = risultato.content.flatMap((blocco) => (blocco.type === "text" ? [blocco.text] : [])).join("\n");
    return { testo, errore: risultato.isError === true };
  }

  // Chiude il collegamento e termina il processo del server.
  async chiudi(): Promise<void> {
    await this.client.close();
  }
}
