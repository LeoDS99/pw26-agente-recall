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
| Server MCP | `src/mcp-server` | in sviluppo |
| Harness agentico | `src/harness` | in sviluppo |

## Requisiti

- Node.js 22 o successivo
- Docker Desktop (per il database PostgreSQL 18)
- Git

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
  diagrammi/           diagrammi UML ed ER (PlantUML)
src/backend/
  db.ts                connessione al database
  sql/                 schema del database
  seed/                dati sintetici
  tipi.ts              tipi di dato
  SoglieAttesa.ts      soglie d'attesa per classe di priorità
  ErroreDominio.ts     errore per le regole di dominio violate
  RecallRepository.ts  query e regole di dominio
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