// RecallMcpServer: il server MCP del Gruppo Sanitario Collemare.
// Riceve la lista dei tool, li registra sull'SDK e si mette in ascolto su
// stdio (il client lo avvia come processo e gli parla su stdin e stdout).
// ATTENZIONE: stdout è il canale del protocollo. Qui dentro non si usa mai
// console.log: i messaggi per noi vanno su console.error (stderr).

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { ErroreDominio } from "../backend/ErroreDominio.js";
import type { RecallTool } from "./RecallTool.js";

export class RecallMcpServer {
  private readonly server: McpServer;
  private readonly tools: RecallTool[];

  constructor(tools: RecallTool[]) {
    this.server = new McpServer({ name: "recall-collemare", version: "1.0.0" });
    this.tools = tools;
    for (const tool of this.tools) this.registra(tool);
  }

  // Registra un tool sull'SDK: nome, descrizione, schemi e annotazione di
  // sola lettura. L'ultima parte è la funzione che l'SDK chiama quando il
  // modello invoca il tool, con i parametri già validati contro lo schema.
  private registra(tool: RecallTool): void {
    this.server.registerTool(
      tool.nome,
      {
        description: tool.descrizione,
        inputSchema: tool.schemaInput,
        outputSchema: tool.schemaOutput,
        annotations: { readOnlyHint: tool.soloLettura },
      },
      async (args) => {
        try {
          // Tutto ok: i dati vanno sia in structuredContent (conformi allo
          // schema di uscita) sia come testo JSON, per i client che leggono solo testo.
          const dati = await tool.esegui(args);
          return { content: [{ type: "text", text: JSON.stringify(dati) }], structuredContent: dati };
        } catch (errore) {
          // Regola di dominio violata: il motivo torna al modello, che lo spiega all'operatore.
          if (errore instanceof ErroreDominio) {
            return { content: [{ type: "text", text: errore.message }], isError: true };
          }
          // Qualsiasi altro errore (es. database spento): dettaglio su stderr per
          // noi, messaggio generico al modello. Il server non si ferma.
          console.error(`[${tool.nome}]`, errore);
          return {
            content: [{ type: "text", text: "Errore tecnico: dati non disponibili in questo momento." }],
            isError: true,
          };
        }
      });
  }

  // Avvia il server su stdio.
  avvia(): void {
    serveStdio(() => this.server);
  }
}