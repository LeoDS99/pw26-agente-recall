// Dati sintetici del Gruppo Sanitario Collemare (impresa fittizia).
// Il seed ha due parti:
//  - dati di base, generati da regole fisse (niente valori casuali);
//  - dati fissi degli scenari di test, segnati con "DATO FISSO": sempre gli
//    stessi numeri e le stesse condizioni, elencati in docs/scenari-test.md.
// Ogni lancio produce gli stessi dati, con le date calcolate da oggi.
// Si lancia dopo schema.sql, che ricrea le tabelle vuote: npm run db:reset

import type { PoolClient } from "pg";
import { pool } from "../db.js";

// --- 1. Date: tutto è relativo al giorno del lancio -------------------------

const oggi = new Date();
oggi.setHours(0, 0, 0, 0);

// giorno(1) = domani, giorno(-30) = un mese fa
function giorno(scarto: number): Date {
  const d = new Date(oggi);
  d.setDate(d.getDate() + scarto);
  return d;
}

// Date nel formato che PostgreSQL accetta: "2026-11-03" e "2026-11-03 09:00"
function data(d: Date): string {
  const mese = String(d.getMonth() + 1).padStart(2, "0");
  const gg = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mese}-${gg}`;
}
function dataOra(d: Date, ora: string): string {
  return `${data(d)} ${ora}`;
}

// --- 2. Anagrafiche fisse e volumi ------------------------------------------

const CENTRO = 1, COSTA = 2, VALLE = 3;
const CARDIOLOGICA = 1, OCULISTICA = 2, DERMATOLOGICA = 3, ECOGRAFIA = 4, RISONANZA = 5;

// Quali prestazioni offre ogni sede (tabella delle sedi in 05)
const SEDI = [
  { id: CENTRO, nome: "Collemare Centro", localita: "capoluogo", prestazioni: [CARDIOLOGICA, OCULISTICA, DERMATOLOGICA, ECOGRAFIA, RISONANZA] },
  { id: COSTA, nome: "Collemare Costa", localita: "paese sul mare", prestazioni: [CARDIOLOGICA, OCULISTICA, DERMATOLOGICA, ECOGRAFIA] },
  { id: VALLE, nome: "Collemare Valle", localita: "entroterra", prestazioni: [CARDIOLOGICA, OCULISTICA, DERMATOLOGICA] },
];

const PRESTAZIONI = [
  { id: CARDIOLOGICA, nome: "Visita cardiologica", tipo: "visita", durata: 30 },
  { id: OCULISTICA, nome: "Visita oculistica", tipo: "visita", durata: 20 },
  { id: DERMATOLOGICA, nome: "Visita dermatologica", tipo: "visita", durata: 20 },
  { id: ECOGRAFIA, nome: "Ecografia addome completo", tipo: "esame", durata: 30 },
  { id: RISONANZA, nome: "Risonanza magnetica articolare", tipo: "esame", durata: 45 },
];

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

const NUM_PAZIENTI = 60;      // 10 nomi x 6 cognomi
const GIORNI_AGENDA = 14;     // da domani, domeniche escluse
const ORARI = ["09:00", "11:00"];  // due slot al giorno per prestazione e sede

// --- 3. Utilità ------------------------------------------------------------

// Esegue un INSERT e restituisce l'id della riga creata
async function inserisci(c: PoolClient, sql: string, valori: unknown[]): Promise<number> {
  const risultato = await c.query<{ id: number }>(`${sql} RETURNING id`, valori);
  return risultato.rows[0]!.id;
}

interface Slot { id: number; sede: number; prestazione: number; scarto: number }

// --- 4. Seed ---------------------------------------------------------------

async function seed(c: PoolClient): Promise<void> {
  // Sedi e prestazioni, con id fissi
  for (const s of SEDI) {
    await c.query("INSERT INTO sedi (id, nome, localita) VALUES ($1, $2, $3)",
      [s.id, s.nome, s.localita]);
  }
  for (const p of PRESTAZIONI) {
    await c.query("INSERT INTO prestazioni (id, nome, tipo, durata_minuti) VALUES ($1, $2, $3, $4)",
      [p.id, p.nome, p.tipo, p.durata]);
  }

  // Pazienti: il numero 1 è Maria Rossi (DATO FISSO, scenario 10: richiesta 4410).
  // Gli altri: 10 nomi x 6 cognomi; telefono con prefisso inesistente.
  const pazienti: number[] = [];
  for (let i = 1; i <= NUM_PAZIENTI; i++) {
    const nome = i === 1 ? "Maria" : NOMI[i % 10];
    const cognome = i === 1 ? "Rossi" : COGNOMI[Math.floor(i / 10) % 6];
    pazienti.push(await inserisci(c,
      "INSERT INTO pazienti (nome, cognome, telefono, sede_riferimento_id) VALUES ($1, $2, $3, $4)",
      [nome, cognome, `+39 000 ${String(i).padStart(7, "0")}`, (i % 3) + 1]));
  }

  // DATO FISSO (scenari 4, 5, 10): slot 812, cardiologica al Centro tra 10 giorni,
  // libero. Come gli altri dati fissi, può cadere anche di domenica.
  await c.query("INSERT INTO slot (id, sede_id, prestazione_id, inizio) VALUES (812, $1, $2, $3)",
    [CENTRO, CARDIOLOGICA, dataOra(giorno(10), "12:30")]);

  // Agenda: da domani per 14 giorni, domeniche escluse (domani sempre, scenario 1)
  const slot: Slot[] = [];
  for (let scarto = 1; scarto <= GIORNI_AGENDA; scarto++) {
    const domenica = giorno(scarto).getDay() === 0;
    if (domenica && scarto > 1) continue;
    for (const s of SEDI) {
      for (const p of s.prestazioni) {
        for (const ora of ORARI) {
          const id = await inserisci(c,
            "INSERT INTO slot (sede_id, prestazione_id, inizio) VALUES ($1, $2, $3)",
            [s.id, p, dataOra(giorno(scarto), ora)]);
          slot.push({ id, sede: s.id, prestazione: p, scarto });
        }
      }
    }
  }

  // DATI FISSI: slot dell'agenda scelti per gli scenari
  const s5531 = slot.find((s) => s.sede === COSTA && s.prestazione === OCULISTICA && s.scarto >= 3)!;  // scenari 2, 11
  const liberiCentro = slot.filter((s) => s.sede === CENTRO && s.scarto <= 7).slice(-4);  // scenario 3
  const cardioValle = slot.filter((s) => s.sede === VALLE && s.prestazione === CARDIOLOGICA);
  const attesaBreve = cardioValle.slice(0, 2);   // scenario 13: classe B entro i 10 giorni
  const attesaLunga = cardioValle.slice(-2);     // scenario 13: classe B oltre i 10 giorni

  // Prenotazioni: nei prossimi 7 giorni tutto occupato tranne 4 slot al Centro;
  // dopo, uno slot su sei resta libero
  for (const [i, s] of slot.entries()) {
    if (s === s5531 || liberiCentro.includes(s)) continue;

    let classe = CLASSI[i % 10];
    let giorniPassati = 2 + (i % 4) * 10;  // richiesta fatta 2, 12, 22 o 32 giorni fa
    if (attesaBreve.includes(s)) { classe = "B"; giorniPassati = 1; }
    else if (attesaLunga.includes(s)) { classe = "B"; giorniPassati = 20; }
    else if (s.scarto >= 8 && i % 6 === 0) continue;  // libero

    const confermata = s.scarto <= 2 && i % 2 === 0;
    const richiesta = await inserisci(c,
      `INSERT INTO richieste (paziente_id, prestazione_id, classe_priorita, data_richiesta, stato)
       VALUES ($1, $2, $3, $4, 'prenotata')`,
      [pazienti[i % NUM_PAZIENTI], s.prestazione, classe, data(giorno(-giorniPassati))]);
    const prenotazione = await inserisci(c,
      `INSERT INTO prenotazioni (slot_id, richiesta_id, stato, creata_il) VALUES ($1, $2, $3, $4)`,
      [s.id, richiesta, confermata ? "confermata" : "da_confermare", dataOra(giorno(-giorniPassati), "10:00")]);
    if (confermata) {
      await c.query(
        "INSERT INTO contatti (prenotazione_id, esito, registrato_il) VALUES ($1, 'confermato', $2)",
        [prenotazione, dataOra(giorno(-1), "16:00")]);
    }
  }

  // DATO FISSO (scenari 2, 11): prenotazione 5531, oculistica a Costa, da confermare
  const richiesta5531 = await inserisci(c,
    `INSERT INTO richieste (paziente_id, prestazione_id, classe_priorita, data_richiesta, stato)
     VALUES ($1, $2, 'D', $3, 'prenotata')`,
    [pazienti[4], OCULISTICA, data(giorno(-20))]);
  await c.query(
    `INSERT INTO prenotazioni (id, slot_id, richiesta_id, stato, creata_il)
     VALUES (5531, $1, $2, 'da_confermare', $3)`,
    [s5531.id, richiesta5531, dataOra(giorno(-20), "10:00")]);

  // DATO FISSO (scenari 3, 4, 5, 11): lista d'attesa, 6 richieste per prestazione
  // di classi diverse (candidati per lo slot 812 e per sostituire la 5531)
  const CLASSI_ATTESA = ["U", "B", "D", "P", "D", "P"];
  for (const p of PRESTAZIONI) {
    for (let k = 0; k < CLASSI_ATTESA.length; k++) {
      await c.query(
        `INSERT INTO richieste (paziente_id, prestazione_id, classe_priorita, data_richiesta, stato)
         VALUES ($1, $2, $3, $4, 'in_attesa')`,
        [pazienti[k * 10 + p.id], p.id, CLASSI_ATTESA[k], data(giorno(-(5 + k * 15)))]);
    }
  }

  // DATO FISSO (scenario 10): richiesta 4410, Rossi, dermatologica, in attesa
  await c.query(
    `INSERT INTO richieste (id, paziente_id, prestazione_id, classe_priorita, data_richiesta, stato)
     VALUES (4410, $1, $2, 'P', $3, 'in_attesa')`,
    [pazienti[0], DERMATOLOGICA, data(giorno(-30))]);

  // Gli id fissi (812, 4410, 5531) sono più alti di tutti quelli assegnati in
  // automatico (qualche centinaio), quindi non entrano mai in conflitto.
}

// --- 5. Controllo: i dati degli scenari ci sono? ---------------------------

async function controlla(c: PoolClient): Promise<void> {
  const conta = async (sql: string, valori: unknown[] = []) =>
    (await c.query<{ n: number }>(`SELECT count(*)::int AS n ${sql}`, valori)).rows[0]!.n;
  const libero = "NOT EXISTS (SELECT 1 FROM prenotazioni p WHERE p.slot_id = s.id AND p.stato <> 'disdetta')";

  for (const t of ["sedi", "prestazioni", "pazienti", "slot", "richieste", "prenotazioni", "contatti"]) {
    console.log(`${t.padEnd(13)} ${await conta(`FROM ${t}`)}`);
  }
  console.log("--- dati degli scenari");
  console.log("prenotazione 5531 da confermare:",
    await conta("FROM prenotazioni WHERE id = 5531 AND stato = 'da_confermare'"));
  console.log("slot 812 libero:", await conta(`FROM slot s WHERE s.id = 812 AND ${libero}`));
  console.log("cardiologiche in attesa (candidati per 812):",
    await conta(`FROM richieste WHERE prestazione_id = ${CARDIOLOGICA} AND stato = 'in_attesa'`));
  console.log("richiesta 4410 in attesa:", await conta("FROM richieste WHERE id = 4410 AND stato = 'in_attesa'"));
  console.log("domani a Costa da confermare:",
    await conta(`FROM prenotazioni p JOIN slot s ON s.id = p.slot_id
                 WHERE s.sede_id = ${COSTA} AND s.inizio::date = $1 AND p.stato = 'da_confermare'`,
      [data(giorno(1))]));
  console.log("slot liberi al Centro nei prossimi 7 giorni:",
    await conta(`FROM slot s WHERE s.sede_id = ${CENTRO} AND s.inizio >= $1 AND s.inizio < $2 AND ${libero}`,
      [data(giorno(1)), data(giorno(8))]));
  const cardioB = `FROM prenotazioni p JOIN slot s ON s.id = p.slot_id JOIN richieste r ON r.id = p.richiesta_id
                   WHERE r.prestazione_id = ${CARDIOLOGICA} AND r.classe_priorita = 'B'`;
  console.log("cardiologiche B entro / oltre 10 giorni d'attesa:",
    await conta(`${cardioB} AND s.inizio::date - r.data_richiesta <= 10`), "/",
    await conta(`${cardioB} AND s.inizio::date - r.data_richiesta > 10`));
}

// --- 6. Tutto in una transazione: o passa tutto, o non resta niente ------------

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
