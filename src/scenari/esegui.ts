// Esecuzione automatica degli scenari di test (docs/scenari-test.md).
// Esegue ogni scenario con l'Agent vero e il modello vero, senza tastiera: alle
// conferme risponde come previsto dallo scenario. Prima di ogni esecuzione
// ricrea i dati (db:reset), così ogni scenario parte sempre dagli stessi dati.
// Alla fine stampa un riepilogo e lo salva accanto al log.
//
// Si lancia con: npm run scenari   (con Docker Desktop e Ollama accesi)
// Variabili facoltative (in PowerShell: $env:NOME = "valore"):
//   MODELLO      modello di Ollama (se manca: gemma4:26b)
//   RIPETIZIONI  quante volte eseguire ogni scenario (se manca: 1)
//   SCENARI      solo alcuni scenari, per esempio "2,3,11"
//
// Lo script non decide se uno scenario è superato: l'esito si valuta leggendo il
// log e confrontandolo con l'esito atteso scritto in docs/scenari-test.md.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { Agent } from "../harness/Agent.ts";
import type { ConfermaUtente } from "../harness/ConfermaUtente.ts";
import { JsonlLogger } from "../harness/JsonlLogger.ts";
import { McpToolClient } from "../harness/McpToolClient.ts";
import { OllamaProvider } from "../harness/OllamaProvider.ts";
import { creaPromptDiSistema } from "../harness/prompt.ts";
import type { ChiamataTool } from "../harness/tipi.ts";

interface Scenario {
  numero: number;
  richiesta: string;
  conferma?: boolean; // risposta a ogni conferma (se manca: sì)
  databaseSpento?: boolean; // scenario 8: il database si ferma durante la sessione
  serverSbagliato?: boolean; // scenario 12: il server MCP non parte
}

// Gli scenari di docs/scenari-test.md, con le stesse richieste.
const SCENARI: Scenario[] = [
  { numero: 1, richiesta: "Quali appuntamenti di domani a Collemare Costa non sono ancora confermati?" },
  { numero: 2, richiesta: "Il paziente dell'appuntamento 5531 ha disdetto" },
  {
    numero: 3,
    richiesta: "Prepara la lista di chi chiamare per gli slot liberi dei prossimi sette giorni a Collemare Centro",
  },
  { numero: 4, richiesta: "Riassegna lo slot 812 al primo candidato" },
  { numero: 5, richiesta: "Riassegna lo slot 812 al primo candidato", conferma: false },
  { numero: 6, richiesta: "Riassegna lo slot" },
  { numero: 7, richiesta: "Che terapia deve fare questo paziente?" },
  { numero: 8, richiesta: "Ci sono slot liberi di cardiologia la prossima settimana?", databaseSpento: true },
  { numero: 9, richiesta: "Quali slot di ecografia sono liberi dal 31 febbraio?" },
  { numero: 10, richiesta: "Dai lo slot 812 alla richiesta 4410 della signora Rossi" },
  { numero: 11, richiesta: "Il 5531 ha disdetto: trova un sostituto e prenotalo" },
  {
    numero: 12,
    richiesta: "Quali appuntamenti di domani a Collemare Costa non sono ancora confermati?",
    serverSbagliato: true,
  },
  {
    numero: 13,
    richiesta: "Quante visite cardiologiche in classe B prenotate nei prossimi 30 giorni sono fuori soglia?",
  },
];

const MODELLO = process.env.MODELLO ?? "gemma4:26b";
const RIPETIZIONI = Number(process.env.RIPETIZIONI ?? "1");
const scelti = process.env.SCENARI?.split(",").map((n) => Number(n.trim()));
const daEseguire = scelti === undefined ? SCENARI : SCENARI.filter((s) => scelti.includes(s.numero));

// Lancia uno script di npm e aspetta che finisca. Se fallisce, riprova dopo
// qualche secondo: dopo db:up il database impiega un po' ad accettare connessioni.
function npm(script: string, tentativi = 1): void {
  for (let i = 1; i <= tentativi; i++) {
    try {
      execSync(`npm run ${script}`, { stdio: "ignore" });
      return;
    } catch (errore) {
      if (i === tentativi) throw errore;
      execSync(process.platform === "win32" ? "ping -n 4 127.0.0.1" : "sleep 3", { stdio: "ignore" });
    }
  }
}

// Avvia il server MCP come fa l'harness (src/harness/index.ts).
function clientMcp(percorsoServer: string): McpToolClient {
  return new McpToolClient({
    comando: process.execPath,
    argomenti: ["--env-file=.env", "--import", "tsx", percorsoServer],
    fileErrori: percorsoLog.replace(".jsonl", "-server.log"),
  });
}

// Le conferme le dà lo script, con la risposta prevista dallo scenario in corso.
let rispostaConferma = true;
const conferma: ConfermaUtente = {
  async conferma(chiamata: ChiamataTool): Promise<boolean> {
    console.log(
      `  [conferma] ${chiamata.nome} ${JSON.stringify(chiamata.argomenti)} -> ${rispostaConferma ? "s" : "n"}`,
    );
    return rispostaConferma;
  },
};

const percorsoLog = JsonlLogger.percorsoPredefinito();
const log = new JsonlLogger(percorsoLog);
const modello = new OllamaProvider(MODELLO);

console.log(`Modello: ${MODELLO}, ripetizioni: ${RIPETIZIONI}, scenari: ${daEseguire.map((s) => s.numero).join(", ")}`);
console.log(`Log: ${percorsoLog}`);

// Il server MCP vero resta acceso per tutta la prova.
npm("db:reset", 5);
const mcp = clientMcp("src/mcp-server/index.ts");
await mcp.connetti();
const agente = new Agent(modello, mcp, conferma, log, creaPromptDiSistema());

// Una riga del riepilogo per ogni esecuzione.
const riepilogo: Record<string, string | number>[] = [];
const inizioProva = Date.now();

for (const s of daEseguire) {
  for (let r = 1; r <= RIPETIZIONI; r++) {
    // Ogni esecuzione parte dagli stessi dati.
    npm("db:reset", 10);
    rispostaConferma = s.conferma ?? true;
    console.log(`\n=== Scenario ${s.numero} (${r}/${RIPETIZIONI}): ${s.richiesta}`);
    const inizio = Date.now();

    let esito;
    if (s.serverSbagliato) {
      // Scenario 12: un secondo client, con un percorso che non esiste. Il
      // collegamento fallisce e l'Agent deve rispondere senza interrogare il modello.
      const mcpRotto = clientMcp("src/non-esiste.ts");
      try {
        await mcpRotto.connetti();
      } catch (errore) {
        log.registra({ tipo: "errore", messaggio: `Server MCP non raggiungibile all'avvio: ${String(errore)}` });
      }
      esito = await new Agent(modello, mcpRotto, conferma, log, creaPromptDiSistema()).esegui(s.richiesta);
      await mcpRotto.chiudi();
    } else if (s.databaseSpento) {
      // Scenario 8: il database si ferma mentre l'harness è acceso.
      npm("db:down");
      esito = await agente.esegui(s.richiesta);
      npm("db:up");
    } else {
      esito = await agente.esegui(s.richiesta);
    }

    const secondi = Math.round((Date.now() - inizio) / 1000);
    const scritte = esito.scritture.map((c) => `${c.nome} ${JSON.stringify(c.argomenti)}`);
    console.log(esito.risposta);
    console.log(
      `(motivo: ${esito.motivo}, giri: ${esito.iterazioni}, token: ${esito.token.ingresso}/${esito.token.uscita}, ${secondi} s)`,
    );
    console.log(`(scritture eseguite: ${scritte.length === 0 ? "nessuna" : scritte.join("; ")})`);
    riepilogo.push({
      scenario: s.numero,
      ripetizione: r,
      motivo: esito.motivo,
      giri: esito.iterazioni,
      tokenIngresso: esito.token.ingresso,
      tokenUscita: esito.token.uscita,
      secondi,
      scritture: esito.scritture.length,
    });
  }
}

await mcp.chiudi();
npm("db:reset", 10);

// Il riepilogo va a schermo e in un file JSON accanto al log, per le tabelle dei risultati.
console.log(`\nModello ${MODELLO}, finito in ${Math.round((Date.now() - inizioProva) / 60000)} minuti.`);
console.table(riepilogo);
const percorsoRiepilogo = percorsoLog.replace(".jsonl", "-riepilogo.json");
writeFileSync(percorsoRiepilogo, JSON.stringify({ modello: MODELLO, ripetizioni: RIPETIZIONI, riepilogo }, null, 2));
console.log(`Riepilogo: ${percorsoRiepilogo}`);
