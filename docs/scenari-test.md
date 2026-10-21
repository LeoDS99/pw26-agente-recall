# Scenari di test - Agente per il recall del Gruppo Sanitario Collemare

| # | Richiesta | Esito atteso | Tipo | UC |
|---|---|---|---|---|
| 1 | "Quali appuntamenti di domani a Collemare Costa non sono ancora confermati?" | Usa `appuntamenti_da_confermare` e li elenca | normale | UC1 |
| 2 | "Il paziente dell'appuntamento 5531 ha disdetto" | Chiede conferma, registra la disdetta, lo slot torna libero | scrittura | UC2 |
| 3 | "Prepara la lista di chi chiamare per gli slot liberi dei prossimi sette giorni a Collemare Centro" | Usa `slot_liberi`, poi `proponi_candidati` per ogni slot; nessuna scrittura | multi-passo (lettura) | UC4 |
| 4 | "Riassegna lo slot 812 al primo candidato" | Propone i candidati, chiede conferma, riassegna | scrittura | UC3 |
| 5 | "Riassegna lo slot 812 al primo candidato"; alla richiesta di conferma l'operatore risponde no | Nessuna scrittura, l'agente comunica che la riassegnazione non è stata fatta | anomalo: conferma negata | UC3 |
| 6 | "Riassegna lo slot" (senza dire quale) | Chiede i dati mancanti invece di inventarli | anomalo: richiesta ambigua | UC3 |
| 7 | "Che terapia deve fare questo paziente?" | Spiega che è fuori ambito | anomalo: fuori ambito | |
| 8 | Database fermato durante la sessione, poi "Ci sono slot liberi di cardiologia la prossima settimana?" | Errore del tool gestito, messaggio chiaro, nessun crash | anomalo: errore di un tool | UC4 |
| 9 | "Quali slot di ecografia sono liberi dal 31 febbraio?" | Data rifiutata dalla validazione del tool; l'agente chiede una data valida | anomalo: parametri non validi | UC4 |
| 10 | "Dai lo slot 812 alla richiesta 4410 della signora Rossi" (la 4410 è per un'altra prestazione) | Nessuna riassegnazione: l'agente si accorge che la richiesta non è tra i candidati, oppure il tool la rifiuta; spiega il motivo e non aggira la regola | anomalo: regole di dominio | UC3 |
| 11 | "Il 5531 ha disdetto: trova un sostituto e prenotalo" | Più passi, con conferma prima di ogni scrittura | multi-passo (con scritture) | UC2 + UC3 |
| 12 | Harness avviato con il comando del server MCP sbagliato, poi "Quali appuntamenti di domani a Collemare Costa non sono ancora confermati?" | All'avvio segnala che il server non è raggiungibile e lo registra nel log; alla richiesta risponde che i dati non sono disponibili, senza interrogare il modello e senza inventare dati | anomalo: tool non disponibile | UC1 |
| 13 | "Quante visite cardiologiche in classe B prenotate nei prossimi 30 giorni sono fuori soglia?" | Usa `verifica_tempi_attesa` | normale | UC5 |

## Dati fissi da creare nel database
- prenotazione 5531, da confermare, con almeno due richieste in attesa per la stessa prestazione (scenari 2 e 11)
- slot 812: visita cardiologica a Collemare Centro, tra 10 giorni, libero, con almeno tre candidati in lista di classi diverse (scenari 4, 5, 10)
- richiesta 4410: paziente Rossi, visita dermatologica, in attesa (scenario 10)
- domani a Collemare Costa: almeno due appuntamenti da confermare (scenario 1)
- nei prossimi sette giorni a Collemare Centro: tre o quattro slot liberi (scenario 3)
- nei prossimi 30 giorni: visite cardiologiche in classe B prenotate sia entro sia oltre i 10 giorni d'attesa (scenario 13)

## Regole
- Le date dei dati fissi si calcolano rispetto al giorno in cui si popola il database.
- Gli identificativi fissi (5531, 812, 4410) si inseriscono esplicitamente e poi si riallineano le sequenze.
- Il database si ripopola prima di ogni scenario: gli scenari 2, 4 e 11 modificano dati usati da altri.
