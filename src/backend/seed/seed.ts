// =============================================================================
// SEED: riempie il database con dati sintetici del Gruppo Sanitario Collemare
// (impresa fittizia). Nessun dato reale.
//
// Il seed ha due parti:
//  1. DATI DI BASE: sedi, prestazioni, pazienti, agenda e prenotazioni,
//     generati da regole fisse (niente valori casuali).
//  2. DATI FISSI DEGLI SCENARI DI TEST, segnati con "DATO FISSO": sempre gli
//     stessi numeri (slot 812, prenotazione 5531, richiesta 4410) e le stesse
//     condizioni, così ogni scenario ha un esito atteso scritto in anticipo.
//     L'elenco completo è in docs/scenari-test.md.
//
// Ogni lancio produce gli stessi dati. Le date non sono scritte a mano: si
// calcolano a partire dal giorno in cui si lancia il seed.
//
// Come si lancia: npm run db:reset
// (prima schema.sql ricrea le tabelle vuote, poi parte questo file)
// =============================================================================

import type { PoolClient } from "pg";
import { pool } from "../db.ts";
import { CENTRO, COSTA, VALLE, CARDIOLOGICA, OCULISTICA, DERMATOLOGICA, SEDI, PRESTAZIONI } from "../catalogo.ts";

// --- 1. DATE: tutto è relativo al giorno del lancio --------------------------

// Oggi a mezzanotte: è il punto di partenza di tutte le date del seed.
const oggi = new Date();
oggi.setHours(0, 0, 0, 0);

// giorno(scarto): restituisce la data di oggi spostata di "scarto" giorni.
// Esempi: giorno(1) = domani, giorno(10) = tra dieci giorni, giorno(-30) = un mese fa.
function giorno(scarto: number): Date {
  const d = new Date(oggi);
  d.setDate(d.getDate() + scarto);
  return d;
}

// data(d): trasforma una data nel testo che PostgreSQL accetta, es. "2026-11-03".
// padStart aggiunge lo zero davanti: il mese 3 diventa "03".
function data(d: Date): string {
  const mese = String(d.getMonth() + 1).padStart(2, "0"); // getMonth() parte da 0
  const gg = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mese}-${gg}`;
}

// dataOra(d, ora): come data(), con l'orario attaccato, es. "2026-11-03 09:00".
function dataOra(d: Date, ora: string): string {
  return `${data(d)} ${ora}`;
}

// --- 2. COSTANTI: anagrafiche fisse e volumi ---------------------------------

// Sedi e prestazioni (con i loro id) stanno in catalogo.ts, importato sopra.

// Nomi e cognomi inventati, combinati tra loro per creare i pazienti.
const NOMI = ["Marco", "Giulia", "Luca", "Francesca", "Andrea", "Chiara", "Matteo", "Sara", "Paolo", "Elena"];
const COGNOMI = ["Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco"];

// Classi di priorità della prescrizione SSN (Piano nazionale di governo
// delle liste d'attesa, PNGLA): la lettera sulla ricetta dice entro quando
// la prestazione va erogata.
//   U = Urgente       entro 72 ore
//   B = Breve         entro 10 giorni
//   D = Differibile   entro 30 giorni per le visite, 60 per gli esami
//   P = Programmata   entro 120 giorni
// Qui sono assegnate a rotazione: ogni 10 prenotazioni, 1 U, 2 B, 3 D, 4 P.
const CLASSI = ["P", "D", "B", "P", "D", "P", "B", "D", "P", "U"];

const NUM_PAZIENTI = 60; // 10 nomi x 6 cognomi
const GIORNI_AGENDA = 14; // l'agenda va da domani a tra 14 giorni
const ORARI = ["09:00", "11:00"]; // due slot al giorno per ogni prestazione in ogni sede

// --- 3. UTILITÀ ----------------------------------------------------------------

// inserisci(c, sql, valori): esegue un INSERT e restituisce l'id della riga
// appena creata (lo chiede a PostgreSQL con "RETURNING id"). Serve quando una
// riga va collegata a un'altra: per esempio la prenotazione alla sua richiesta.
async function inserisci(c: PoolClient, sql: string, valori: unknown[]): Promise<number> {
  const risultato = await c.query<{ id: number }>(`${sql} RETURNING id`, valori);
  return risultato.rows[0]!.id;
}

// Uno slot dell'agenda come lo ricorda il seed dopo averlo creato:
// id nel database, sede, prestazione e "scarto" (tra quanti giorni è).
interface Slot {
  id: number;
  sede: number;
  prestazione: number;
  scarto: number;
}

// --- 4. SEED: crea tutti i dati -------------------------------------------------

// seed(c): inserisce tutti i dati, in quest'ordine:
//   a. sedi e prestazioni
//   b. pazienti
//   c. slot 812 (DATO FISSO)
//   d. agenda: tutti gli slot dei prossimi 14 giorni
//   e. scelta degli slot che servono agli scenari (DATI FISSI)
//   f. prenotazioni sugli slot dell'agenda
//   g. prenotazione 5531 (DATO FISSO)
//   h. lista d'attesa (DATO FISSO)
//   i. richiesta 4410 (DATO FISSO)
// "c" è una sola connessione al database: tutte le query passano di lì, così
// stanno nella stessa transazione (vedi la parte 6 in fondo).
async function seed(c: PoolClient): Promise<void> {
  // a. SEDI E PRESTAZIONI, con l'id scritto a mano: deve coincidere con le
  // costanti CENTRO, CARDIOLOGICA eccetera. $1, $2... sono segnaposto: i valori
  // li passa il driver a parte, mai incollati dentro il testo SQL.
  for (const s of SEDI) {
    await c.query("INSERT INTO sedi (id, nome, localita) VALUES ($1, $2, $3)", [s.id, s.nome, s.localita]);
  }
  for (const p of PRESTAZIONI) {
    await c.query("INSERT INTO prestazioni (id, nome, tipo, durata_minuti) VALUES ($1, $2, $3, $4)", [
      p.id,
      p.nome,
      p.tipo,
      p.durata,
    ]);
  }

  // b. PAZIENTI: 60, con l'id assegnato dal database.
  // Il paziente 1 è sempre Maria Rossi (DATO FISSO, scenario 10: richiesta 4410).
  // Gli altri: l'unità di i sceglie il nome, la decina il cognome, quindi non
  // ci sono omonimi. Il telefono ha un prefisso inesistente (+39 000).
  // La sede di riferimento ruota tra 1, 2 e 3: 20 pazienti per sede.
  // L'array "pazienti" tiene gli id creati: pazienti[0] è Maria Rossi.
  const pazienti: number[] = [];
  for (let i = 1; i <= NUM_PAZIENTI; i++) {
    const nome = i === 1 ? "Maria" : NOMI[i % 10];
    const cognome = i === 1 ? "Rossi" : COGNOMI[Math.floor(i / 10) % 6];
    pazienti.push(
      await inserisci(
        c,
        "INSERT INTO pazienti (nome, cognome, telefono, sede_riferimento_id) VALUES ($1, $2, $3, $4)",
        [nome, cognome, `+39 000 ${String(i).padStart(7, "0")}`, (i % 3) + 1],
      ),
    );
  }

  // c. DATO FISSO (scenari 4, 5, 10): slot 812, cardiologica al Centro tra 10
  // giorni, alle 12:30 (orario diverso dall'agenda, così si riconosce).
  // Tra 10 giorni perché deve stare fuori dai "prossimi 7 giorni" dello
  // scenario 3. Resta libero perché non entra nell'array "slot" qui sotto,
  // e il passo f prenota solo gli slot di quell'array.
  // Come gli altri dati fissi, può cadere anche di domenica.
  await c.query("INSERT INTO slot (id, sede_id, prestazione_id, inizio) VALUES (812, $1, $2, $3)", [
    CENTRO,
    CARDIOLOGICA,
    dataOra(giorno(10), "12:30"),
  ]);

  // d. AGENDA: per ogni giorno da domani a tra 14 giorni, per ogni sede, per
  // ogni prestazione di quella sede, per ogni orario, crea uno slot.
  // Le domeniche si saltano (getDay() === 0 è domenica), tranne domani: così
  // lo scenario 1 ("appuntamenti di domani") ha sempre i dati.
  // Ogni slot creato finisce anche nell'array "slot", usato nei passi e ed f.
  const slot: Slot[] = [];
  for (let scarto = 1; scarto <= GIORNI_AGENDA; scarto++) {
    const domenica = giorno(scarto).getDay() === 0;
    if (domenica && scarto > 1) continue; // continue = salta questo giorno
    for (const s of SEDI) {
      for (const p of s.prestazioni) {
        for (const ora of ORARI) {
          const id = await inserisci(c, "INSERT INTO slot (sede_id, prestazione_id, inizio) VALUES ($1, $2, $3)", [
            s.id,
            p,
            dataOra(giorno(scarto), ora),
          ]);
          slot.push({ id, sede: s.id, prestazione: p, scarto });
        }
      }
    }
  }

  // e. DATI FISSI: tra gli slot dell'agenda, mette da parte quelli che servono
  // agli scenari. Ogni scenario usa una sede diversa, così non si disturbano.
  //  - s5531: il primo slot di oculistica a Costa ad almeno 3 giorni da oggi.
  //    Lì andrà la prenotazione 5531 (scenari 2, 11). Il "!" dice a TypeScript
  //    che lo slot esiste di sicuro (Costa ha oculistica tutti i giorni).
  //  - liberiCentro: gli ultimi 4 slot del Centro nei prossimi 7 giorni.
  //    Resteranno liberi (scenario 3).
  //  - attesaBreve e attesaLunga: le prime 2 e le ultime 2 cardiologiche di
  //    Valle. Diventeranno classe B con attesa entro e oltre i 10 giorni (scenario 13).
  const s5531 = slot.find((s) => s.sede === COSTA && s.prestazione === OCULISTICA && s.scarto >= 3)!; // scenari 2, 11
  const liberiCentro = slot.filter((s) => s.sede === CENTRO && s.scarto <= 7).slice(-4); // scenario 3
  const cardioValle = slot.filter((s) => s.sede === VALLE && s.prestazione === CARDIOLOGICA);
  const attesaBreve = cardioValle.slice(0, 2); // scenario 13: classe B entro i 10 giorni
  const attesaLunga = cardioValle.slice(-2); // scenario 13: classe B oltre i 10 giorni

  // f. PRENOTAZIONI: per ogni slot dell'agenda decide se resta libero o viene
  // prenotato. "i" è la posizione dello slot nell'array: con il resto della
  // divisione (%) fa ruotare classi, date e pazienti senza valori casuali.
  // Risultato: nei prossimi 7 giorni tutto occupato tranne i 4 slot del Centro;
  // dal giorno 8 in poi uno slot su sei resta libero.
  for (const [i, s] of slot.entries()) {
    // La 5531 si prenota a parte (passo g); i 4 del Centro devono restare liberi.
    if (s === s5531 || liberiCentro.includes(s)) continue;

    // Classe di priorità e anzianità della richiesta, a rotazione.
    let classe = CLASSI[i % 10];
    let giorniPassati = 2 + (i % 4) * 10; // richiesta fatta 2, 12, 22 o 32 giorni fa

    // Le urgenti (U, entro 72 ore) si prenotano solo nei prossimi 2 giorni,
    // con la richiesta di ieri: come in un'azienda vera, stanno entro soglia.
    // Più avanti nell'agenda lo slot va a una richiesta programmata (P).
    if (classe === "U") {
      if (s.scarto <= 2) giorniPassati = 1;
      else classe = "P";
    }

    // Eccezioni per lo scenario 13; altrimenti, dal giorno 8, uno slot su sei resta libero.
    if (attesaBreve.includes(s)) {
      classe = "B";
      giorniPassati = 1;
    } // attesa ~2 giorni: entro soglia
    else if (attesaLunga.includes(s)) {
      classe = "B";
      giorniPassati = 20;
    } // attesa oltre 30 giorni: fuori soglia
    else if (s.scarto >= 8 && i % 6 === 0) continue; // libero

    // Confermate solo metà delle prenotazioni dei prossimi 2 giorni: il recall
    // si fa a ridosso dell'appuntamento. Tutte le altre sono "da confermare".
    const confermata = s.scarto <= 2 && i % 2 === 0;

    // Ogni prenotazione nasce da una richiesta (la ricetta del paziente):
    // prima la richiesta, poi la prenotazione collegata alla richiesta.
    const richiesta = await inserisci(
      c,
      `INSERT INTO richieste (paziente_id, prestazione_id, classe_priorita, data_richiesta, stato)
       VALUES ($1, $2, $3, $4, 'prenotata')`,
      [pazienti[i % NUM_PAZIENTI], s.prestazione, classe, data(giorno(-giorniPassati))],
    );
    const prenotazione = await inserisci(
      c,
      `INSERT INTO prenotazioni (slot_id, richiesta_id, stato, creata_il) VALUES ($1, $2, $3, $4)`,
      [s.id, richiesta, confermata ? "confermata" : "da_confermare", dataOra(giorno(-giorniPassati), "10:00")],
    );

    // Una prenotazione confermata ha anche la telefonata che l'ha confermata (ieri alle 16).
    if (confermata) {
      await c.query("INSERT INTO contatti (prenotazione_id, esito, registrato_il) VALUES ($1, 'confermato', $2)", [
        prenotazione,
        dataOra(giorno(-1), "16:00"),
      ]);
    }
  }

  // g. DATO FISSO (scenari 2, 11): prenotazione 5531, oculistica a Costa, da
  // confermare. Richiesta in classe D di 20 giorni fa, paziente numero 5.
  const richiesta5531 = await inserisci(
    c,
    `INSERT INTO richieste (paziente_id, prestazione_id, classe_priorita, data_richiesta, stato)
     VALUES ($1, $2, 'D', $3, 'prenotata')`,
    [pazienti[4], OCULISTICA, data(giorno(-20))],
  );
  await c.query(
    `INSERT INTO prenotazioni (id, slot_id, richiesta_id, stato, creata_il)
     VALUES (5531, $1, $2, 'da_confermare', $3)`,
    [s5531.id, richiesta5531, dataOra(giorno(-20), "10:00")],
  );

  // h. DATO FISSO (scenari 3, 4, 5, 11): lista d'attesa. Per ogni prestazione,
  // 6 richieste non ancora prenotate, con classi diverse (U, B, D, P, D, P) e
  // date sempre più vecchie (5, 20, 35, 50, 65, 80 giorni fa). Sono i candidati
  // per lo slot 812 e per sostituire la 5531: l'ordinamento si può verificare.
  const CLASSI_ATTESA = ["U", "B", "D", "P", "D", "P"];
  for (const p of PRESTAZIONI) {
    for (let k = 0; k < CLASSI_ATTESA.length; k++) {
      await c.query(
        `INSERT INTO richieste (paziente_id, prestazione_id, classe_priorita, data_richiesta, stato)
         VALUES ($1, $2, $3, $4, 'in_attesa')`,
        [pazienti[k * 10 + p.id], p.id, CLASSI_ATTESA[k], data(giorno(-(5 + k * 15)))],
      );
    }
  }

  // i. DATO FISSO (scenario 10): richiesta 4410, Maria Rossi, dermatologica, in
  // attesa. È una richiesta vera ma per un'altra prestazione: lo slot 812
  // (cardiologia) deve rifiutarla.
  await c.query(
    `INSERT INTO richieste (id, paziente_id, prestazione_id, classe_priorita, data_richiesta, stato)
     VALUES (4410, $1, $2, 'P', $3, 'in_attesa')`,
    [pazienti[0], DERMATOLOGICA, data(giorno(-30))],
  );

  // Gli id fissi (812, 4410, 5531) sono più alti di tutti quelli assegnati in
  // automatico (qualche centinaio), quindi non entrano mai in conflitto.
}

// --- 5. CONTROLLO: i dati degli scenari ci sono? --------------------------------

// controlla(c): stampa quante righe ci sono in ogni tabella e poi 7 controlli
// sui dati fissi degli scenari. È l'autotest del seed: se un numero è diverso
// da quello atteso, uno scenario non partirebbe dai dati giusti.
// Valori attesi: 1, 1, 6, 1, 4, 4 e "4 / 8" (l'ultimo può variare col giorno
// della settimana: di sabato esce "4 / 9").
async function controlla(c: PoolClient): Promise<void> {
  // conta(sql): esegue "SELECT count(*) ..." e restituisce il numero.
  const conta = async (sql: string, valori: unknown[] = []) =>
    (await c.query<{ n: number }>(`SELECT count(*)::int AS n ${sql}`, valori)).rows[0]!.n;
  // Condizione SQL "slot libero": nessuna prenotazione attiva (non disdetta) su quello slot.
  const libero = "NOT EXISTS (SELECT 1 FROM prenotazioni p WHERE p.slot_id = s.id AND p.stato <> 'disdetta')";

  // Righe per tabella
  for (const t of ["sedi", "prestazioni", "pazienti", "slot", "richieste", "prenotazioni", "contatti"]) {
    console.log(`${t.padEnd(13)} ${await conta(`FROM ${t}`)}`);
  }

  // Dati degli scenari
  console.log("--- dati degli scenari");
  console.log(
    "prenotazione 5531 da confermare:",
    await conta("FROM prenotazioni WHERE id = 5531 AND stato = 'da_confermare'"),
  );
  console.log("slot 812 libero:", await conta(`FROM slot s WHERE s.id = 812 AND ${libero}`));
  console.log(
    "cardiologiche in attesa (candidati per 812):",
    await conta(`FROM richieste WHERE prestazione_id = ${CARDIOLOGICA} AND stato = 'in_attesa'`),
  );
  console.log("richiesta 4410 in attesa:", await conta("FROM richieste WHERE id = 4410 AND stato = 'in_attesa'"));
  console.log(
    "domani a Costa da confermare:",
    await conta(
      `FROM prenotazioni p JOIN slot s ON s.id = p.slot_id
                 WHERE s.sede_id = ${COSTA} AND s.inizio::date = $1 AND p.stato = 'da_confermare'`,
      [data(giorno(1))],
    ),
  );
  console.log(
    "slot liberi al Centro nei prossimi 7 giorni:",
    await conta(`FROM slot s WHERE s.sede_id = ${CENTRO} AND s.inizio >= $1 AND s.inizio < $2 AND ${libero}`, [
      data(giorno(1)),
      data(giorno(8)),
    ]),
  );
  // Attesa = data dello slot meno data della richiesta, confrontata con la soglia B (10 giorni).
  const cardioB = `FROM prenotazioni p JOIN slot s ON s.id = p.slot_id JOIN richieste r ON r.id = p.richiesta_id
                   WHERE r.prestazione_id = ${CARDIOLOGICA} AND r.classe_priorita = 'B'`;
  console.log(
    "cardiologiche B entro / oltre 10 giorni d'attesa:",
    await conta(`${cardioB} AND s.inizio::date - r.data_richiesta <= 10`),
    "/",
    await conta(`${cardioB} AND s.inizio::date - r.data_richiesta > 10`),
  );
}

// --- 6. AVVIO: tutto in una transazione --------------------------------------------

// Qui parte il programma. Prende una connessione dal pool e:
//  - BEGIN apre la transazione;
//  - seed() inserisce tutti i dati;
//  - COMMIT li rende definitivi, poi controlla() stampa il riepilogo.
// Se qualcosa va storto, ROLLBACK annulla tutto: il database resta vuoto,
// mai riempito a metà. Alla fine (finally) la connessione torna al pool e il
// pool si chiude: senza pool.end() il programma resterebbe acceso.
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await seed(client);
  await client.query("COMMIT");
  console.log(`Seed completato, date calcolate da oggi (${data(oggi)}).`);
  await controlla(client);
} catch (errore) {
  await client.query("ROLLBACK");
  throw errore;
} finally {
  client.release();
  await pool.end();
}
