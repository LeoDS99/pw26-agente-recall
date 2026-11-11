# Tool del server MCP

Il server MCP `recall-collemare` (`src/mcp-server`) espone sei tool sopra il back-end: quattro di sola lettura e due di scrittura. Questo documento descrive ogni tool come lo vede il modello: nome, descrizione, parametri di ingresso, risultato, effetti sui dati, errori ed esempio di invocazione.

| Tool | Tipo | Casi d'uso | Scenari di test |
|---|---|---|---|
| [`appuntamenti_da_confermare`](#appuntamenti_da_confermare) | lettura | UC1 | 1, 12 |
| [`slot_liberi`](#slot_liberi) | lettura | UC4 | 3, 8, 9 |
| [`proponi_candidati`](#proponi_candidati) | lettura | UC3, UC4 | 3, 4, 5, 10, 11 |
| [`verifica_tempi_attesa`](#verifica_tempi_attesa) | lettura | UC5 | 13 |
| [`registra_esito_contatto`](#registra_esito_contatto) | **scrittura** | UC1, UC2 | 2, 11 |
| [`riassegna_slot`](#riassegna_slot) | **scrittura** | UC3 | 4, 5, 10, 11 |

## Regole comuni

- **Trasporto:** stdio. Il client (MCP Inspector o l'harness) avvia il server come processo.
- **Schemi:** ogni tool dichiara lo schema dei parametri di ingresso e lo schema del risultato. L'SDK controlla i parametri prima di eseguire il tool.
- **Risultato:** i dati sono in `structuredContent`, conformi allo schema di uscita, e ripetuti come testo JSON in `content`.
- **Sola lettura o scrittura:** i tool di lettura hanno l'annotazione `readOnlyHint: true`, quelli di scrittura `readOnlyHint: false`. Per i secondi l'harness chiede conferma all'operatore prima dell'esecuzione.
- **Sedi e prestazioni** si indicano per nome, con i valori elencati nello schema.
- **Errori:** in tutti i casi il tool risponde con `isError: true` e un messaggio, e il server resta in funzione.
  - *Errore di validazione:* un parametro non rispetta lo schema. Il messaggio comincia con `Input validation error`.
  - *Errore di dominio:* la richiesta viola una regola del processo. Il messaggio spiega il motivo.
  - *Errore tecnico:* per esempio il database non è raggiungibile. Il messaggio è generico (`Errore tecnico: dati non disponibili in questo momento.`) e il dettaglio va solo nel log del server.

## Come provare un tool

Con il database avviato e popolato (`npm run db:up`, `npm run db:reset`), da PowerShell:

```
npx -y @modelcontextprotocol/inspector --cli --method tools/call --tool-name proponi_candidati --tool-arg slotId=812 limite=2 '--' npx tsx --env-file=.env src/mcp-server/index.ts
```

Per l'elenco dei tool con i loro schemi si usa `--method tools/list` al posto di `--method tools/call` e dei parametri del tool.

Gli esempi di questo documento sono stati eseguiti l'11/11/2026 subito dopo `npm run db:reset`. Le date dei dati sintetici dipendono dal giorno in cui si lancia il comando; i numeri di slot, prenotazioni e richieste restano gli stessi.

## appuntamenti_da_confermare

- **Tipo:** lettura
- **Casi d'uso:** UC1
- **Scenari di test:** 1, 12

**Descrizione** (il testo che riceve il modello): Elenca le prenotazioni dei prossimi giorni (da domani) non ancora confermate, con paziente e telefono, in ordine di data e ora. Serve per sapere chi chiamare nel giro di conferme. Non modifica i dati.

**Parametri di ingresso**

| Parametro | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `giorni` | intero da 1 a 14 | sì | Quanti giorni guardare, a partire da domani (1 = solo domani) |
| `sede` | uno tra: `Collemare Centro`, `Collemare Costa`, `Collemare Valle` | no | Solo questa sede (se manca: tutte) |

**Risultato**

| Campo | Tipo | Descrizione |
|---|---|---|
| `appuntamenti` | elenco di oggetti | Le prenotazioni da confermare, in ordine di data e ora |
| `appuntamenti[].prenotazioneId` | numero | Numero della prenotazione |
| `appuntamenti[].paziente` | testo | Nome e cognome del paziente |
| `appuntamenti[].telefono` | testo | Telefono del paziente (fittizio) |
| `appuntamenti[].prestazione` | testo | Nome della prestazione |
| `appuntamenti[].sede` | testo | Nome della sede |
| `appuntamenti[].inizio` | testo | Data e ora dell'appuntamento, `AAAA-MM-GG HH:MM` |

**Effetti sui dati:** Nessuno: legge soltanto.

**Errori gestiti**

- `giorni` fuori dall'intervallo 1-14 o sede non in elenco: errore di validazione.

**Esempio di invocazione**

Parametri:

```json
{"giorni": 1, "sede": "Collemare Costa"}
```

Risultato (`structuredContent`):

```json
{
  "appuntamenti": [
    {
      "prenotazioneId": 12,
      "paziente": "Luca Romano",
      "telefono": "+39 000 0000012",
      "prestazione": "Visita cardiologica",
      "sede": "Collemare Costa",
      "inizio": "2026-11-12 11:00"
    },
    {
      "prenotazioneId": 14,
      "paziente": "Andrea Romano",
      "telefono": "+39 000 0000014",
      "prestazione": "Visita oculistica",
      "sede": "Collemare Costa",
      "inizio": "2026-11-12 11:00"
    },
    {
      "prenotazioneId": 16,
      "paziente": "Matteo Romano",
      "telefono": "+39 000 0000016",
      "prestazione": "Visita dermatologica",
      "sede": "Collemare Costa",
      "inizio": "2026-11-12 11:00"
    },
    {
      "prenotazioneId": 18,
      "paziente": "Paolo Romano",
      "telefono": "+39 000 0000018",
      "prestazione": "Ecografia addome completo",
      "sede": "Collemare Costa",
      "inizio": "2026-11-12 11:00"
    }
  ]
}
```

## slot_liberi

- **Tipo:** lettura
- **Casi d'uso:** UC4
- **Scenari di test:** 3, 8, 9

**Descrizione** (il testo che riceve il modello): Elenca gli slot ancora liberi (senza prenotazioni attive) tra due date, con filtri facoltativi per prestazione e sede. Restituisce solo slot futuri. Non modifica i dati.

**Parametri di ingresso**

| Parametro | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `dal` | data `AAAA-MM-GG` | sì | Primo giorno da cercare, formato AAAA-MM-GG |
| `al` | data `AAAA-MM-GG` | no | Ultimo giorno compreso, formato AAAA-MM-GG (se manca: 30 giorni dopo "dal") |
| `prestazione` | uno tra: `Visita cardiologica`, `Visita oculistica`, `Visita dermatologica`, `Ecografia addome completo`, `Risonanza magnetica articolare` | no | Solo questa prestazione (se manca: tutte) |
| `sede` | uno tra: `Collemare Centro`, `Collemare Costa`, `Collemare Valle` | no | Solo questa sede (se manca: tutte) |

**Risultato**

| Campo | Tipo | Descrizione |
|---|---|---|
| `slot` | elenco di oggetti | Gli slot liberi, in ordine di data e ora |
| `slot[].slotId` | numero | Numero dello slot |
| `slot[].prestazione` | testo | Nome della prestazione |
| `slot[].sede` | testo | Nome della sede |
| `slot[].inizio` | testo | Data e ora dell'appuntamento, `AAAA-MM-GG HH:MM` |

**Effetti sui dati:** Nessuno: legge soltanto.

**Errori gestiti**

- Data inesistente o in un formato diverso da AAAA-MM-GG: errore di validazione (scenario 9).
- Prestazione o sede non in elenco: errore di validazione, con l'elenco dei valori ammessi.
- Data finale precedente a quella iniziale: errore di dominio.

**Esempio di invocazione**

Parametri:

```json
{"dal": "2026-11-12", "al": "2026-11-18", "sede": "Collemare Centro"}
```

Risultato (`structuredContent`):

```json
{
  "slot": [
    {
      "slotId": 127,
      "prestazione": "Ecografia addome completo",
      "sede": "Collemare Centro",
      "inizio": "2026-11-18 09:00"
    },
    {
      "slotId": 129,
      "prestazione": "Risonanza magnetica articolare",
      "sede": "Collemare Centro",
      "inizio": "2026-11-18 09:00"
    },
    {
      "slotId": 128,
      "prestazione": "Ecografia addome completo",
      "sede": "Collemare Centro",
      "inizio": "2026-11-18 11:00"
    },
    {
      "slotId": 130,
      "prestazione": "Risonanza magnetica articolare",
      "sede": "Collemare Centro",
      "inizio": "2026-11-18 11:00"
    }
  ]
}
```

Esempio di errore, con i parametri:

```json
{"dal": "2027-02-31"}
```

```json
{
  "content": [
    {
      "type": "text",
      "text": "Input validation error: Invalid arguments for tool slot_liberi: dal: Invalid ISO date"
    }
  ],
  "isError": true
}
```

## proponi_candidati

- **Tipo:** lettura
- **Casi d'uso:** UC3, UC4
- **Scenari di test:** 3, 4, 5, 10, 11

**Descrizione** (il testo che riceve il modello): Per uno slot libero, elenca i pazienti in lista d'attesa per la stessa prestazione, già nell'ordine in cui chiamarli: classe di priorità (U, B, D, P), poi data della richiesta, poi sede di riferimento. L'ordine è deciso dal sistema e non va cambiato. Non modifica i dati.

**Parametri di ingresso**

| Parametro | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `slotId` | intero positivo | sì | Numero dello slot libero |
| `limite` | intero da 1 a 10 | no | Quanti candidati restituire (se manca: 5) |

**Risultato**

| Campo | Tipo | Descrizione |
|---|---|---|
| `slotId` | numero | Numero dello slot |
| `candidati` | elenco di oggetti | I candidati, nell'ordine in cui chiamarli |
| `candidati[].richiestaId` | numero | Numero della richiesta in lista d'attesa |
| `candidati[].paziente` | testo | Nome e cognome del paziente |
| `candidati[].telefono` | testo | Telefono del paziente (fittizio) |
| `candidati[].classePriorita` | uno tra: `U`, `B`, `D`, `P` | Classe di priorità della richiesta |
| `candidati[].dataRichiesta` | testo | Data della richiesta, `AAAA-MM-GG` |
| `candidati[].stessaSede` | vero o falso | Vero se la sede di riferimento del paziente è quella dello slot |

**Effetti sui dati:** Nessuno: legge soltanto.

**Errori gestiti**

- Slot inesistente o non libero: errore di dominio.

**Esempio di invocazione**

Parametri:

```json
{"slotId": 812, "limite": 2}
```

Risultato (`structuredContent`):

```json
{
  "slotId": 812,
  "candidati": [
    {
      "richiestaId": 262,
      "paziente": "Luca Bianchi",
      "telefono": "+39 000 0000002",
      "classePriorita": "U",
      "dataRichiesta": "2026-11-06",
      "stessaSede": false
    },
    {
      "richiestaId": 263,
      "paziente": "Luca Romano",
      "telefono": "+39 000 0000012",
      "classePriorita": "B",
      "dataRichiesta": "2026-10-22",
      "stessaSede": true
    }
  ]
}
```

Esempio di errore, con i parametri:

```json
{"slotId": 12}
```

```json
{
  "content": [
    {
      "type": "text",
      "text": "Lo slot 12 non è libero."
    }
  ],
  "isError": true
}
```

## verifica_tempi_attesa

- **Tipo:** lettura
- **Casi d'uso:** UC5
- **Scenari di test:** 13

**Descrizione** (il testo che riceve il modello): Per le prenotazioni attive con appuntamento tra due date, conta per ogni prestazione e classe di priorità quante rispettano la soglia massima d'attesa (entroSoglia) e quante la superano (fuoriSoglia). L'attesa è il numero di giorni tra la richiesta e l'appuntamento. Soglie: U 3 giorni, B 10, D 30 per le visite e 60 per gli esami, P 120. Non modifica i dati.

**Parametri di ingresso**

| Parametro | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `dal` | data `AAAA-MM-GG` | sì | Primo giorno di appuntamenti da considerare, formato AAAA-MM-GG |
| `al` | data `AAAA-MM-GG` | no | Ultimo giorno compreso, formato AAAA-MM-GG (se manca: 30 giorni dopo "dal") |
| `prestazione` | uno tra: `Visita cardiologica`, `Visita oculistica`, `Visita dermatologica`, `Ecografia addome completo`, `Risonanza magnetica articolare` | no | Solo questa prestazione (se manca: tutte) |
| `classe` | uno tra: `U`, `B`, `D`, `P` | no | Solo questa classe di priorità (se manca: tutte) |

**Risultato**

| Campo | Tipo | Descrizione |
|---|---|---|
| `tempi` | elenco di oggetti | Una riga per ogni coppia di prestazione e classe di priorità |
| `tempi[].prestazione` | testo | Nome della prestazione |
| `tempi[].classePriorita` | uno tra: `U`, `B`, `D`, `P` | Classe di priorità della richiesta |
| `tempi[].sogliaGiorni` | numero | Soglia massima d'attesa, in giorni |
| `tempi[].entroSoglia` | numero | Numero di prenotazioni con attesa entro la soglia |
| `tempi[].fuoriSoglia` | numero | Numero di prenotazioni con attesa oltre la soglia |

**Effetti sui dati:** Nessuno: legge soltanto.

**Errori gestiti**

- Data inesistente, prestazione o classe non in elenco: errore di validazione.
- Data finale precedente a quella iniziale: errore di dominio.

**Esempio di invocazione**

Parametri:

```json
{"dal": "2026-11-11", "prestazione": "Visita cardiologica", "classe": "B"}
```

Risultato (`structuredContent`):

```json
{
  "tempi": [
    {
      "prestazione": "Visita cardiologica",
      "classePriorita": "B",
      "sogliaGiorni": 10,
      "entroSoglia": 4,
      "fuoriSoglia": 8
    }
  ]
}
```

## registra_esito_contatto

- **Tipo:** scrittura (richiede la conferma dell'operatore)
- **Casi d'uso:** UC1, UC2
- **Scenari di test:** 2, 11

**Descrizione** (il testo che riceve il modello): Registra l'esito di una telefonata su una prenotazione e ne aggiorna lo stato. confermato: la prenotazione diventa confermata. disdetto: la prenotazione viene disdetta e lo slot torna libero (slotLiberato = true, slotId = lo slot da riassegnare). non_raggiungibile: resta da confermare. MODIFICA i dati.

**Parametri di ingresso**

| Parametro | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `prenotazioneId` | intero positivo | sì | Numero della prenotazione (appuntamento) |
| `esito` | uno tra: `confermato`, `disdetto`, `non_raggiungibile` | sì | Esito della telefonata: il paziente conferma, disdice, oppure non ha risposto |

**Risultato**

| Campo | Tipo | Descrizione |
|---|---|---|
| `prenotazioneId` | numero | Numero della prenotazione |
| `esito` | uno tra: `confermato`, `disdetto`, `non_raggiungibile` | L'esito registrato |
| `statoPrenotazione` | testo | Stato della prenotazione dopo la registrazione |
| `slotLiberato` | vero o falso | true se lo slot è tornato libero e si può riassegnare |
| `slotId` | numero | Numero dello slot della prenotazione |

**Effetti sui dati:** Aggiunge una riga a `contatti`. Con `confermato` la prenotazione passa a `confermata`. Con `disdetto` la prenotazione passa a `disdetta`, la richiesta a `annullata` e lo slot torna libero. Con `non_raggiungibile` lo stato non cambia. Tutto in una transazione.

**Errori gestiti**

- Esito non in elenco: errore di validazione.
- Prenotazione inesistente o già disdetta: errore di dominio.

**Esempio di invocazione**

Parametri:

```json
{"prenotazioneId": 5531, "esito": "disdetto"}
```

Risultato (`structuredContent`):

```json
{
  "prenotazioneId": 5531,
  "esito": "disdetto",
  "statoPrenotazione": "disdetta",
  "slotLiberato": true,
  "slotId": 61
}
```

Esempio di errore, ripetendo la stessa chiamata:

```json
{
  "content": [
    {
      "type": "text",
      "text": "La prenotazione 5531 è già disdetta."
    }
  ],
  "isError": true
}
```

## riassegna_slot

- **Tipo:** scrittura (richiede la conferma dell'operatore)
- **Casi d'uso:** UC3
- **Scenari di test:** 4, 5, 10, 11

**Descrizione** (il testo che riceve il modello): Prenota uno slot libero per una richiesta in lista d'attesa: crea la prenotazione, già confermata, e toglie la richiesta dalla lista. Funziona solo se lo slot è libero e la richiesta è in attesa per la stessa prestazione dello slot: altrimenti risponde con il motivo del rifiuto, che va riferito all'operatore senza cercare di aggirarlo. MODIFICA i dati.

**Parametri di ingresso**

| Parametro | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `slotId` | intero positivo | sì | Numero dello slot libero da assegnare |
| `richiestaId` | intero positivo | sì | Numero della richiesta in lista d'attesa (campo richiestaId di proponi_candidati) |

**Risultato**

| Campo | Tipo | Descrizione |
|---|---|---|
| `prenotazioneId` | numero | Numero della nuova prenotazione |
| `slotId` | numero | Numero dello slot |
| `richiestaId` | numero | Numero della richiesta in lista d'attesa |
| `paziente` | testo | Nome e cognome del paziente |
| `inizio` | testo | Data e ora dell'appuntamento |
| `stato` | testo | Stato della nuova prenotazione |

**Effetti sui dati:** Crea una prenotazione `confermata` nello slot, aggiunge a `contatti` la telefonata con esito `confermato` e porta la richiesta a `prenotata`. Tutto in una transazione. Un indice unico nel database impedisce comunque due prenotazioni attive sullo stesso slot.

**Errori gestiti**

- Slot inesistente, già passato o non libero: errore di dominio.
- Richiesta inesistente, non in lista d'attesa o per una prestazione diversa da quella dello slot: errore di dominio (scenario 10).

**Esempio di invocazione**

Parametri:

```json
{"slotId": 812, "richiestaId": 262}
```

Risultato (`structuredContent`):

```json
{
  "prenotazioneId": 261,
  "slotId": 812,
  "richiestaId": 262,
  "paziente": "Luca Bianchi",
  "inizio": "2026-11-21 12:30",
  "stato": "confermata"
}
```

Esempio di errore, con i parametri:

```json
{"slotId": 812, "richiestaId": 4410}
```

```json
{
  "content": [
    {
      "type": "text",
      "text": "La richiesta 4410 è per \"Visita dermatologica\", lo slot 812 è per \"Visita cardiologica\"."
    }
  ],
  "isError": true
}
```
