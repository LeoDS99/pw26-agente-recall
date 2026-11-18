// Esecuzione automatica degli scenari di test (docs/scenari-test.md).
// Esegue ogni scenario con l'Agent vero e il modello vero, senza tastiera: alle
// conferme risponde come previsto dallo scenario. Prima di ogni esecuzione
// ricrea i dati (db:reset) e azzera la memoria dell'agente, così ogni scenario
// parte sempre dalle stesse condizioni. Uno scenario può avere più richieste di
// fila (scenario 14): dalla seconda in poi l'agente ricorda le precedenti.
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
import type { ChiamataTool, EsitoAgente } from "../harness/tipi.ts";

interface Scenario {
  numero: number;
  richieste: string[]; // una o più richieste, nell'ordine in cui le scrive l'operatore
  conferma?: boolean; // risposta a ogni conferma (se manca: sì)
  databaseSpento?: boolean; // scenario 8: il database si ferma durante la sessione
  serverSbagliato?: boolean; // scenario 12: il server MCP non parte
}

// Gli scenari di docs/scenari-test.md, con le stesse richieste.
const SCENARI: Scenario[] = [
  { numero: 1, richieste: ["Quali appuntamenti di domani a Collemare Costa non sono ancora confermati?"] },
  { numero: 2, richieste: ["Il paziente dell'appuntamento 5531 ha disdetto"] },
  {
    numero: 3,
    richieste: ["Prepara la lista di chi chiamare per gli slot liberi dei prossimi sette giorni a Collemare Centro"],
  },
  { numero: 4, richieste: ["Riassegna lo slot 812 al primo candidato"] },
  { numero: 5, richieste: ["Riassegna lo slot 812 al primo candidato"], conferma: false },
  { numero: 6, richieste: ["Riassegna lo slot"] },
  { numero: 7, richieste: ["Che terapia deve fare questo paziente?"] },
  { numero: 8, richieste: ["Ci sono slot liberi di cardiologia la prossima settimana?"], databaseSpento: true },
  { numero: 9, richieste: ["Quali slot di ecografia sono liberi dal 31 febbraio?"] },
  { numero: 10, richieste: ["Dai lo slot 812 alla richiesta 4410 della signora Rossi"] },
  { numero: 11, richieste: ["Il 5531 ha disdetto: trova un sostituto e prenotalo"] },
  {
    numero: 12,
    richieste: ["Quali appuntamenti di domani a Collemare Costa non sono ancora confermati?"],
    serverSbagliato: true,
  },
  {
    numero: 13,
    richieste: ["Quante visite cardiologiche in classe B prenotate nei prossimi 30 giorni sono fuori soglia?"],
  },
  // Due richieste di fila: la seconda si capisce solo ricordando la prima.
  { numero: 14, richieste: ["Riassegna lo slot", "Lo slot 812, al primo candidato"] },
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

// Esegue una richiesta dello scenario, con le condizioni particolari degli scenari 8 e 12.
async function eseguiRichiesta(s: Scenario, richiesta: string): Promise<EsitoAgente> {
  if (s.serverSbagliato) {
    // Scenario 12: un secondo client, con un percorso che non esiste. Il
    // collegamento fallisce e l'Agent deve rispondere senza interrogare il modello.
    const mcpRotto = clientMcp("src/non-esiste.ts");
    try {
      await mcpRotto.connetti();
    } catch (errore) {
      log.registra({ tipo: "errore", messaggio: `Server MCP non raggiungibile all'avvio: ${String(errore)}` });
    }
    const esito = await new Agent(modello, mcpRotto, conferma, log, creaPromptDiSistema()).esegui(richiesta);
    await mcpRotto.chiudi();
    return esito;
  }
  if (s.databaseSpento) {
    // Scenario 8: il database si ferma mentre l'harness è acceso.
    npm("db:down");
    const esito = await agente.esegui(richiesta);
    npm("db:up");
    return esito;
  }
  return agente.esegui(richiesta);
}

// Una riga del riepilogo per ogni esecuzione.
const riepilogo: Record<string, string | number>[] = [];
const inizioProva = Date.now();

for (const s of daEseguire) {
  for (let r = 1; r <= RIPETIZIONI; r++) {
    // Ogni esecuzione parte dagli stessi dati e senza memoria.
    npm("db:reset", 10);
    agente.azzeraMemoria();
    rispostaConferma = s.conferma ?? true;
    console.log(`\n=== Scenario ${s.numero} (${r}/${RIPETIZIONI})`);
    const inizio = Date.now();

    // Le richieste dello scenario, una dopo l'altra. Nel riepilogo giri, token e
    // scritture sono la somma di tutte le richieste.
    const motivi: string[] = [];
    let giri = 0;
    let tokenIngresso = 0;
    let tokenUscita = 0;
    let scritture = 0;
    for (const richiesta of s.richieste) {
      console.log(`> ${richiesta}`);
      const esito = await eseguiRichiesta(s, richiesta);
      const scritte = esito.scritture.map((c) => `${c.nome} ${JSON.stringify(c.argomenti)}`);
      console.log(esito.risposta);
      console.log(
        `(motivo: ${esito.motivo}, giri: ${esito.iterazioni}, token: ${esito.token.ingresso}/${esito.token.uscita})`,
      );
      console.log(`(scritture eseguite: ${scritte.length === 0 ? "nessuna" : scritte.join("; ")})`);
      motivi.push(esito.motivo);
      giri += esito.iterazioni;
      tokenIngresso += esito.token.ingresso;
      tokenUscita += esito.token.uscita;
      scritture += esito.scritture.length;
    }

    const secondi = Math.round((Date.now() - inizio) / 1000);
    console.log(`(scenario ${s.numero}: ${secondi} s)`);
    riepilogo.push({
      scenario: s.numero,
      ripetizione: r,
      motivo: motivi.join(" / "),
      giri,
      tokenIngresso,
      tokenUscita,
      secondi,
      scritture,
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
