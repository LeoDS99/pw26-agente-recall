# Casi d'uso - Agente per il recall del Gruppo Sanitario Collemare

## Attori
- **Operatore**: operatore del centro prenotazioni. Gestisce conferme, disdette e riassegnazioni.
- **Responsabile**: responsabile delle liste d'attesa. Controlla i tempi d'attesa.

Gli attori sono gli utenti dell'agente: l'agente li aiuta, non li sostituisce.

## UC1 - Gestisci il giro di conferme
- Attore: Operatore
- Obiettivo: confermare gli appuntamenti dei prossimi giorni.
- Descrizione: l'operatore chiede chi deve chiamare, eventualmente per una sede. Mentre telefona, comunica all'agente gli esiti uno alla volta.
- Scrive sui dati: sì
- Include: UC2

## UC2 - Registra l'esito di un contatto
- Attore: Operatore
- Obiettivo: tenere aggiornato lo stato di una prenotazione.
- Descrizione: l'operatore registra se il paziente ha confermato, disdetto o non risponde, anche quando è il paziente a chiamare per disdire. Se disdice, lo slot torna libero.
- Scrive sui dati: sì
- Punto di estensione: slot liberato

## UC3 - Recupera uno slot libero
- Attore: Operatore
- Obiettivo: riassegnare un posto libero a un paziente in lista d'attesa.
- Descrizione: il sistema propone i pazienti in lista per quella prestazione, già ordinati secondo regole fisse (classe di priorità, data della richiesta, sede). L'operatore li chiama; quando uno accetta, chiede di prenotarlo e conferma.
- Scrive sui dati: sì
- Estende: UC2, al punto "slot liberato". Si può avviare anche da solo, su uno slot già libero.

## UC4 - Pianifica il recupero della settimana
- Attore: Operatore
- Obiettivo: avere pronta la lista delle chiamate per riempire i posti liberi.
- Descrizione: per tutti gli slot liberi dei prossimi giorni, eventualmente per una sede, il sistema prepara l'elenco dei candidati da chiamare per ciascuno.
- Scrive sui dati: no

## UC5 - Verifica i tempi d'attesa
- Attore: Responsabile
- Obiettivo: sapere dove i tempi d'attesa superano le soglie.
- Descrizione: il responsabile chiede, per prestazione e classe di priorità, quante prenotazioni sono entro la soglia e quante fuori.
- Scrive sui dati: no

## Fuori dal sistema
- Telefonare o mandare SMS ai pazienti: lo fa l'operatore, il sistema registra solo l'esito.
- Decisioni o consigli clinici.
- Scavalcare l'ordine della lista d'attesa, anche su richiesta esplicita.