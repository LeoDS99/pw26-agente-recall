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
| Harness agentico | `src/harness` | in sviluppo |

## Requisiti

- Node.js 22 o successivo
- Docker Desktop (per il database PostgreSQL 18)
- Git

Per provare il server con MCP Inspector serve Node.js 22.23.4 o successivo
(oppure 24.22.1 o successivo).

## Installazione

```
git clone https://github.com/LeoDS99/pw26-agente-recall.git
cd pw26-agente-recall
cp .env.example .env
npm ci
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
Usa il trasporto stdio: non si avvia a mano, lo avvia il client (MCP Inspector
oppure l'harness) con questo comando:

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

## Dati sintetici

Lo script `src/backend/seed/seed.ts` crea due tipi di dati:

- **dati di base**, generati da regole fisse e senza valori casuali: ogni
  lancio produce gli stessi dati, con le date calcolate dal giorno del lancio;
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
```

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run db:up` | avvia il database |
| `npm run db:down` | ferma il database |
| `npm run db:schema` | ricrea le tabelle vuote |
| `npm run db:seed` | inserisce i dati sintetici |
| `npm run db:reset` | `db:schema` + `db:seed` |
| `npm run typecheck` | controlla i tipi TypeScript |
| `npm run format` | formatta il codice con Prettier |
| `npm run format:check` | controlla la formattazione senza modificare i file |
