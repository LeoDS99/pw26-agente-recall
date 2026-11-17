// Punto di ingresso dell'harness: crea i pezzi, li collega e avvia la riga di comando.
// Si lancia con: npm run agente

import { Agent } from "./Agent.ts";
import { Cli } from "./Cli.ts";
import { JsonlLogger } from "./JsonlLogger.ts";
import { McpToolClient } from "./McpToolClient.ts";
import { OllamaProvider } from "./OllamaProvider.ts";
import { creaPromptDiSistema } from "./prompt.ts";

// Modello e percorso del server si possono cambiare senza toccare il codice,
// con le variabili d'ambiente MODELLO e SERVER_MCP (anche nel file .env).
// SERVER_MCP serve per lo scenario 12: con un percorso sbagliato il server non parte.
const MODELLO_PREDEFINITO = "qwen3:4b-instruct";
const SERVER_PREDEFINITO = "src/mcp-server/index.ts";

// Un file di log per ogni avvio, in logs/.
const percorsoLog = JsonlLogger.percorsoPredefinito();
const log = new JsonlLogger(percorsoLog);
const cli = new Cli();

// Il server MCP si avvia come processo figlio, con Node e tsx come per le prove:
// --env-file passa al server le credenziali del database, perché il processo
// figlio non eredita le variabili dell'harness. I suoi messaggi d'errore vanno
// in un file accanto al log, non nel terminale dell'operatore.
const mcp = new McpToolClient({
  comando: process.execPath,
  argomenti: ["--env-file=.env", "--import", "tsx", process.env.SERVER_MCP ?? SERVER_PREDEFINITO],
  fileErrori: percorsoLog.replace(".jsonl", "-server.log"),
});

// Se il server non parte (scenario 12) il programma non si ferma: lo scrive nel
// log e avvisa l'operatore. Alle richieste risponderà l'Agent, con il motivo
// "server_non_disponibile" e senza interrogare il modello.
try {
  await mcp.connetti();
} catch (errore) {
  log.registra({ tipo: "errore", messaggio: errore instanceof Error ? errore.message : String(errore) });
  cli.avvisa(
    "Il sistema delle prenotazioni non è raggiungibile in questo momento: " +
      "non posso leggere né modificare i dati. Riprova più tardi.",
  );
}

const modello = new OllamaProvider(process.env.MODELLO ?? MODELLO_PREDEFINITO);
const agente = new Agent(modello, mcp, cli, log, creaPromptDiSistema());

// Il dialogo con l'operatore. Il finally chiude la tastiera e il processo del
// server anche se qualcosa va storto: altrimenti il server resterebbe acceso.
try {
  await cli.avvia(agente);
} finally {
  cli.chiudi();
  await mcp.chiudi();
}
