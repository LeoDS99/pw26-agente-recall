# Agente per il recall degli appuntamenti - Gruppo Sanitario Collemare

Project Work PW 26 (CdS L-31, Informatica per le Aziende Digitali): integrazione
di un AI agent nel sistema informativo di un'impresa, con un server MCP e un
harness agentico.

Il Gruppo Sanitario Collemare è un'impresa **fittizia** e tutti i dati sono
**sintetici**: nessun dato personale reale, nessun dato aziendale riservato.

Il processo: recall e riassegnazione degli appuntamenti disdetti, più la
verifica dei tempi d'attesa.

## Stato

| Parte | Cartella | Stato |
|---|---|---|
| Back-end e dati sintetici | `src/backend` | fatto |
| Server MCP | `src/mcp-server` | fatto |
| Harness agentico | `src/harness` | fatto |
| Esecuzione degli scenari di test | `docs/scenari-test.md`, `docs/estratti-log` | fatto |

## Requisiti

- Node.js 22 o successivo
- Docker Desktop (per il database PostgreSQL 18)
- Ollama 0.40.18 o successivo, con il modello `gemma4:26b` (per l'harness: circa
  17 GB da scaricare; provato su un PC con 32 GB di RAM, senza scheda video dedicata)
- Git

Per provare il server con MCP Inspector serve Node.js 22.23.4 o successivo
(oppure 24.22.1 o successivo).

## Installazione

```
git clone https://github.com/LeoDS99/pw26-agente-recall.git
cd pw26-agente-recall
cp .env.example .env
npm ci
ollama pull gemma4:26b
```

Il file `.env` contiene le credenziali del database locale. I valori di
`.env.example` vanno bene così come sono.

## Esecuzione

Con Docker Desktop avviato:

```
npm run db:up
npm run db:reset
```

- `db:up` avvia PostgreSQL in un container, raggiungibile solo da questo computer.
- `db:reset` ricrea le tabelle vuote e le riempie con i dati sintetici.

Alla fine `db:reset` stampa un controllo sui dati usati dagli scenari di test.
I valori attesi sono:

```
prenotazione 5531 da confermare: 1
slot 812 libero: 1
cardiologiche in attesa (candidati per 812): 6
richiesta 4410 in attesa: 1
domani a Costa da confermare: 4
slot liberi al Centro nei prossimi 7 giorni: 4
cardiologiche B entro / oltre 10 giorni d'attesa: 4 / 8
```

L'ultimo valore può essere `4 / 9`, a seconda del giorno della settimana in cui
si lancia il comando.

Per fermare il database: `npm run db:down`.

### Server MCP

Il server MCP espone sei tool sopra il back-end, descritti in `docs/tool.md`.
Usa il trasporto stdio: non si avvia a mano, lo avvia il client. L'harness lo
avvia da solo; MCP Inspector (vedi sotto) con questo comando:

```
npx tsx --env-file=.env src/mcp-server/index.ts
```

Per provarlo senza l'harness si usa MCP Inspector dalla riga di comando. Con il
database avviato e popolato, l'elenco dei tool:

```
npx -y @modelcontextprotocol/inspector --cli --method tools/list '--' npx tsx --env-file=.env src/mcp-server/index.ts
```

La chiamata di un tool, per esempio i candidati per lo slot 812:

```
npx -y @modelcontextprotocol/inspector --cli --method tools/call --tool-name proponi_candidati --tool-arg slotId=812 limite=2 '--' npx tsx --env-file=.env src/mcp-server/index.ts
```

Gli apici intorno a `'--'` servono in PowerShell. I due tool di scrittura
(`registra_esito_contatto` e `riassegna_slot`) modificano i dati: dopo averli
provati va rilanciato `npm run db:reset`.

### Agente (harness)

L'harness è l'agente vero e proprio: una riga di comando in cui l'operatore
scrive le richieste in italiano. Avvia da solo il server MCP e usa un modello
locale tramite Ollama. Con il database avviato e popolato, e Ollama acceso:

```
npm run agente
```

Per ogni richiesta l'agente risponde e stampa una riga di servizio con il motivo
per cui si è fermato, il numero di giri e i token consumati. Prima di eseguire
un tool che modifica i dati mostra cosa sta per fare e chiede conferma: vale come
sì solo `s`, `si` o `sì`; qualunque altra risposta annulla l'operazione. Per uscire
si scrive `esci`; per ricominciare la conversazione da capo, `nuova`.

L'agente ricorda gli ultimi 5 scambi della sessione (le richieste e le sue
risposte finali, senza i dati letti dai tool): si può rispondere a una sua
domanda o continuare un discorso, per esempio "Riassegna lo slot" e poi "Lo slot
812, al primo candidato". La memoria resta solo in RAM: si azzera con `nuova`,
all'uscita e dopo una richiesta interrotta da un errore o dal limite di giri.

Se Ollama non è acceso, ogni richiesta finisce con il motivo `errore`.

Per ogni avvio, nella cartella `logs/` (esclusa da git):

- `sessione-AAAA-MM-GGTHH-MM-SS.jsonl`: il log di ogni passo (richieste al
  modello, tool chiamati con i parametri, risultati, conferme, token);
- `sessione-AAAA-MM-GGTHH-MM-SS-server.log`: i messaggi d'errore tecnici del
  server MCP, che così non compaiono nel terminale dell'operatore.

Due variabili d'ambiente, facoltative, cambiano il comportamento senza toccare
il codice:

| Variabile | Predefinito | A cosa serve |
|---|---|---|
| `MODELLO` | `gemma4:26b` | usare un altro modello di Ollama, per esempio `qwen3:4b-instruct` su un PC con meno memoria (con risposte meno affidabili) |
| `SERVER_MCP` | `src/mcp-server/index.ts` | con un percorso sbagliato il server non parte: è lo scenario di test 12 |

Si possono scrivere nel file `.env` oppure, solo per il terminale aperto, in
PowerShell:

```
$env:SERVER_MCP = "src/non-esiste.ts"
npm run agente
Remove-Item Env:SERVER_MCP
```

### Scenari di test

Lo script `src/scenari/esegui.ts` esegue in automatico i 14 scenari di
`docs/scenari-test.md`, con l'agente e il modello veri. Con Docker Desktop e
Ollama accesi:

```
npm run scenari
```

Prima di ogni scenario ricrea i dati con `db:reset` e azzera la memoria
dell'agente. Alle conferme risponde come
previsto dallo scenario (no solo nello scenario 5), ferma e riavvia il database
per lo scenario 8 e usa un percorso del server sbagliato per lo scenario 12.
Alla fine stampa una tabella con motivo di arresto, giri, token, secondi e
scritture eseguite di ogni esecuzione, e la salva in
`logs/sessione-...-riepilogo.json`. Lo script non decide se uno scenario è
superato: l'esito si valuta leggendo il log e confrontandolo con l'esito atteso.

| Variabile | Predefinito | A cosa serve |
|---|---|---|
| `MODELLO` | `gemma4:26b` | il modello da usare |
| `RIPETIZIONI` | `1` | quante volte eseguire ogni scenario |
| `SCENARI` | tutti | solo alcuni scenari, per esempio `2,3,11` |

Per esempio, in PowerShell, tre ripetizioni dello scenario 3:

```
$env:SCENARI = "3"
$env:RIPETIZIONI = "3"
npm run scenari
Remove-Item Env:SCENARI, Env:RIPETIZIONI
```

## Dati sintetici

Lo script `src/backend/seed/seed.ts` crea due tipi di dati:

- **dati di base**, generati da regole fisse e da un generatore pseudo-casuale
  con un seme fisso: ogni lancio produce gli stessi dati, con le date calcolate
  dal giorno del lancio;
- **dati fissi degli scenari di test** (per esempio lo slot 812 e la
  prenotazione 5531), elencati in `docs/scenari-test.md`.

Alcuni scenari modificano i dati: prima di ogni scenario va rilanciato
`npm run db:reset`.

## Struttura del repository

```
docs/
  casi-uso.md          casi d'uso
  scenari-test.md      scenari di test e dati fissi
  tool.md              documentazione dei tool del server MCP
  estratti-log/        estratti dei log del giro ufficiale degli scenari
  screenshot/          schermate della riga di comando
  diagrammi/           diagrammi UML ed ER (PlantUML)
src/backend/
  db.ts                connessione al database
  sql/                 schema del database
  seed/                dati sintetici
  catalogo.ts          sedi e prestazioni
  tipi.ts              tipi di dato
  SoglieAttesa.ts      soglie d'attesa per classe di priorità
  ErroreDominio.ts     errore per le regole di dominio violate
  RecallRepository.ts  query e regole di dominio
src/mcp-server/
  index.ts             punto di avvio del server
  RecallMcpServer.ts   registrazione dei tool e gestione degli errori
  RecallTool.ts        classe base dei tool
  date.ts              calcoli sulle date
  tools/               i sei tool, uno per file
src/harness/
  index.ts             punto di avvio dell'agente
  Cli.ts               riga di comando e conferma dell'operatore
  Agent.ts             il ciclo agentico
  prompt.ts            prompt di sistema
  McpToolClient.ts     collegamento al server MCP
  ModelProvider.ts     astrazione dal fornitore del modello
  OllamaProvider.ts    modello locale tramite Ollama
  ConfermaUtente.ts    interfaccia della conferma prima delle scritture
  JsonlLogger.ts       log in formato JSON Lines
  tipi.ts              tipi di dato
src/scenari/
  esegui.ts            esecuzione automatica degli scenari di test
```

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run db:up` | avvia il database |
| `npm run db:down` | ferma il database |
| `npm run db:schema` | ricrea le tabelle vuote |
| `npm run db:seed` | inserisce i dati sintetici |
| `npm run db:reset` | `db:schema` + `db:seed` |
| `npm run agente` | avvia l'agente (riga di comando) |
| `npm run scenari` | esegue gli scenari di test in automatico |
| `npm run typecheck` | controlla i tipi TypeScript |
| `npm run format` | formatta il codice con Prettier |
| `npm run format:check` | controlla la formattazione senza modificare i file |
