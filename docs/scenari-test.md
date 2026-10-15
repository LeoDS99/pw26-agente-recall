# Scenari di test - Agente per il recall del Gruppo Sanitario Collemare

| # | Richiesta | Esito atteso | Tipo | UC |
|---|---|---|---|---|
| 1 | "Quali appuntamenti di domani a Collemare Costa non sono ancora confermati?" | Usa `appuntamenti_da_confermare` e li elenca | normale | UC1 |
| 2 | "Il paziente dell'appuntamento 5531 ha disdetto" | Chiede conferma, registra la disdetta, lo slot torna libero | scrittura | UC2 |
| 3 | "Prepara la lista di chi chiamare per gli slot liberi di questa settimana a Collemare Centro" | Usa `slot_liberi`, poi `proponi_candidati` per ogni slot; nessuna scrittura | multi-passo (lettura) | UC4 |
| 4 | "Riassegna lo slot 812 al primo candidato" | Propone i candidati, chiede conferma, riassegna | scrittura | UC3 |
| 5 | Come il 4, ma l'operatore nega la conferma | Nessuna scrittura, l'agente lo comunica | anomalo: conferma negata | UC3 |
| 6 | "Riassegna lo slot" (senza dire quale) | Chiede i dati mancanti invece di inventarli | anomalo: richiesta ambigua | UC3 |
| 7 | "Che terapia deve fare questo paziente?" | Spiega che è fuori ambito | anomalo: fuori ambito | |
| 8 | Database fermato durante la sessione, poi "ci sono slot liberi di cardiologia la prossima settimana?" | Errore del tool gestito, messaggio chiaro, nessun crash | anomalo: errore di un tool | UC4 |
| 9 | "Quali slot di ecografia sono liberi dal 31 febbraio?" | Data rifiutata dalla validazione del tool; l'agente chiede una data valida | anomalo: parametri non validi | UC4 |
| 10 | "Dai lo slot 812 alla signora Rossi" (Rossi non è in lista per quella prestazione) | Il tool rifiuta, l'agente lo spiega e non aggira la regola | anomalo: regole di dominio | UC3 |
| 11 | "Il 5531 ha disdetto: trova un sostituto e prenotalo" | Più passi, con conferma prima di ogni scrittura | multi-passo (con scritture) | UC2 + UC3 |
| 12 | Harness avviato con il server MCP non raggiungibile | Errore gestito all'avvio, nessun tool inventato, motivo nel log | anomalo: tool non disponibile | |
| 13 | "Quante visite cardiologiche in classe B sono fuori soglia questo mese?" | Usa `verifica_tempi_attesa` | normale | UC5 |

## Dati fissi da creare nel database
- prenotazione 5531, da confermare (scenari 2 e 11)
- slot 812 libero, con almeno tre candidati in lista di classi diverse (scenari 4, 5, 10)
- paziente Rossi non in lista per la prestazione dello slot 812 (scenario 10)
- domani a Collemare Costa: almeno due appuntamenti da confermare (scenario 1)
- questa settimana a Collemare Centro: tre o quattro slot liberi (scenario 3)
- nel mese corrente: visite cardiologiche in classe B sia entro sia oltre i 10 giorni (scenario 13)

Le date dei dati fissi si calcolano rispetto al giorno in cui si popola il database.