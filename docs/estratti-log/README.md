# Estratti dei log degli scenari di test

Questa cartella contiene estratti dei log JSON Lines prodotti da `npm run scenari`
(i log completi stanno in `logs/`, esclusa da git). Servono a documentare gli
esiti degli scenari di `docs/scenari-test.md`.

## Da dove vengono

Giro ufficiale del 18/11/2026 sul commit `49401f2`: 14 scenari, 3 ripetizioni
ciascuno, database ripopolato e memoria dell'agente azzerata prima di ogni
esecuzione. PC con 32 GB di RAM e senza scheda video dedicata (il modello gira
sul processore), Ollama 0.40.16, temperatura 0.

| Cartella | Contenuto |
|---|---|
| `gemma4-26b/` | il modello principale: la prima ripetizione di ogni scenario (`scenario-01.jsonl` ... `scenario-14.jsonl`) e il riepilogo di tutte le 42 esecuzioni (`riepilogo.json`) |
| `qwen3-30b/` | il modello di confronto: il riepilogo e tre estratti con gli errori tipici (azione annunciata e non eseguita, dati inventati) e con la chiamata più lunga, di 356 secondi, andata a buon fine |
| `primo-giro-a892b59/` | dal primo giro ufficiale, sul commit `a892b59`: la chiamata al modello interrotta dopo 300 secondi dal timeout del `fetch` di Node, che ha portato alla correzione con lo streaming |

## Come si leggono

Ogni riga è un evento, con l'ora in UTC (campo `ora`). I tipi di evento sono:

| `tipo` | Cosa registra |
|---|---|
| `inizio` | la richiesta dell'operatore, il modello e quanti scambi c'erano in memoria |
| `richiesta_modello` | una chiamata al modello: il giro del ciclo e quanti messaggi riceve |
| `risposta_modello` | la risposta: testo, tool chiesti con i parametri, token in ingresso e in uscita, durata |
| `conferma` | la conferma chiesta prima di un tool di scrittura e la risposta (`concessa`) |
| `chiamata_tool` e `risultato_tool` | il tool eseguito, i parametri, il risultato e se è un errore |
| `tool_non_disponibile` | un tool chiesto dal modello ma non esposto dal server |
| `errore` | un errore grave (server non raggiungibile, modello che non risponde) |
| `fine` | il motivo di arresto, i giri, i token totali, le scritture eseguite e la risposta per l'operatore |

Nello scenario 12 la prima riga `errore` la scrive lo script degli scenari,
quando il client collegato al percorso sbagliato non riesce ad avviare il server.

## Dati

Pazienti, telefoni e prenotazioni sono sintetici: i telefoni hanno il prefisso
fittizio `+39 000`, che in Italia non è assegnabile. In
`qwen3-30b/scenario-03-dati-inventati.jsonl` il modello ha inventato pazienti con
numeri di cellulare realistici: quei numeri sono oscurati, perché potrebbero
appartenere a persone reali.
