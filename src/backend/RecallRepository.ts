// RecallRepository: l'unica classe che legge e scrive nel database.
// I tool del server MCP non scrivono SQL: chiamano questi metodi.
// Qui stanno anche le regole di dominio (ordinamento dei candidati,
// riassegnazioni valide, tempi d'attesa), così non dipendono dal modello.

import type { Pool } from "pg";

import { SoglieAttesa, type ClassePriorita, type TipoPrestazione } from "./SoglieAttesa.js";

// Errore di dominio: la richiesta viola una regola del processo (slot che non
// esiste, slot già occupato, richiesta non valida). Il tool lo restituirà al
// modello come messaggio chiaro; gli altri errori (es. database spento) no.
export class ErroreDominio extends Error {}

// Una riga del risultato di appuntamentiDaConfermare.
export interface AppuntamentoDaConfermare {
  prenotazioneId: number;
  paziente: string;      // nome e cognome
  telefono: string;
  prestazione: string;
  sede: string;
  inizio: string;        // "2026-11-06 11:00", testo già leggibile
}

// Una riga del risultato di slotLiberi.
export interface SlotLibero {
  slotId: number;
  prestazione: string;
  sede: string;
  inizio: string;        // "2026-11-12 09:00"
}

// Un paziente in lista d'attesa che si può chiamare per uno slot.
export interface Candidato {
  richiestaId: number;
  paziente: string;
  telefono: string;
  classePriorita: ClassePriorita;  // U, B, D o P
  dataRichiesta: string;   // "2026-10-16"
  stessaSede: boolean;     // la sede di riferimento del paziente è quella dello slot
}

// Risultato di candidatiPerSlot: lo slot e i candidati in ordine.
export interface CandidatiSlot {
  slotId: number;
  candidati: Candidato[];
}

// Una riga del risultato di tempiAttesa: per una prestazione e una classe,
// quante prenotazioni rispettano la soglia e quante no.
export interface TempiAttesa {
  prestazione: string;
  classePriorita: ClassePriorita;
  sogliaGiorni: number;
  entroSoglia: number;
  fuoriSoglia: number;
}

export class RecallRepository {
  // Il pool di connessioni arriva da fuori (dal server MCP), non è creato qui.
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Prenotazioni ancora da confermare nei prossimi "giorni" giorni, a partire
  // da domani (giorni = 1: solo domani). Se c'è sedeId, solo quella sede.
  // Ordinate per data e ora: è la lista delle telefonate da fare.
  async appuntamentiDaConfermare(giorni: number, sedeId?: number): Promise<AppuntamentoDaConfermare[]> {
    const { rows } = await this.pool.query<AppuntamentoDaConfermare>(
      `SELECT p.id AS "prenotazioneId",
              pa.nome || ' ' || pa.cognome AS paziente,
              pa.telefono,
              pr.nome AS prestazione,
              se.nome AS sede,
              to_char(s.inizio, 'YYYY-MM-DD HH24:MI') AS inizio
         FROM prenotazioni p
         JOIN slot s         ON s.id = p.slot_id
         JOIN richieste r    ON r.id = p.richiesta_id
         JOIN pazienti pa    ON pa.id = r.paziente_id
         JOIN prestazioni pr ON pr.id = s.prestazione_id
         JOIN sedi se        ON se.id = s.sede_id
        WHERE p.stato = 'da_confermare'
          AND s.inizio >= current_date + 1
          AND s.inizio <  current_date + 1 + $1::int
          AND ($2::int IS NULL OR s.sede_id = $2)
        ORDER BY s.inizio, se.nome`,
      [giorni, sedeId ?? null]);
    return rows;
  }

  // Slot liberi tra le date "dal" e "al" (comprese, formato "2026-11-12"),
  // solo futuri. Filtri facoltativi: prestazione e sede.
  // Uno slot è libero se non ha prenotazioni attive (non disdette):
  // lo slot non ha un campo di stato (scelta del 15/10, vedi 05).
  async slotLiberi(dal: string, al: string, prestazioneId?: number, sedeId?: number): Promise<SlotLibero[]> {
    const { rows } = await this.pool.query<SlotLibero>(
      `SELECT s.id AS "slotId",
              pr.nome AS prestazione,
              se.nome AS sede,
              to_char(s.inizio, 'YYYY-MM-DD HH24:MI') AS inizio
         FROM slot s
         JOIN prestazioni pr ON pr.id = s.prestazione_id
         JOIN sedi se        ON se.id = s.sede_id
        WHERE s.inizio >= $1::date
          AND s.inizio <  $2::date + 1
          AND s.inizio >  localtimestamp
          AND ($3::int IS NULL OR s.prestazione_id = $3)
          AND ($4::int IS NULL OR s.sede_id = $4)
          AND NOT EXISTS (SELECT 1 FROM prenotazioni p
                           WHERE p.slot_id = s.id AND p.stato <> 'disdetta')
        ORDER BY s.inizio, se.nome, pr.nome`,
      [dal, al, prestazioneId ?? null, sedeId ?? null]);
    return rows;
  }

  // Candidati per uno slot libero: richieste in attesa per la stessa
  // prestazione, nell'ordine in cui chiamarli (regola fissa, non del modello):
  //   1. classe di priorità: prima U, poi B, D, P;
  //   2. a parità di classe, chi aspetta da più tempo;
  //   3. a parità di data, chi ha come riferimento la sede dello slot.
  // L'ordine è un suggerimento: l'operatore può scegliere un altro candidato.
  async candidatiPerSlot(slotId: number, limite = 5): Promise<CandidatiSlot> {
    // Prima lo slot: esiste? è libero? di che prestazione e sede è?
    const slot = await this.pool.query<{ prestazione_id: number; sede_id: number; occupato: boolean }>(
      `SELECT s.prestazione_id, s.sede_id,
              EXISTS (SELECT 1 FROM prenotazioni p
                       WHERE p.slot_id = s.id AND p.stato <> 'disdetta') AS occupato
         FROM slot s
        WHERE s.id = $1`,
      [slotId]);
    const s = slot.rows[0];
    if (!s) throw new ErroreDominio(`Lo slot ${slotId} non esiste.`);
    if (s.occupato) throw new ErroreDominio(`Lo slot ${slotId} non è libero.`);

    // Poi i candidati, già ordinati.
    // array_position dà la posizione della classe nell'elenco U, B, D, P:
    // l'ordine alfabetico non va bene (B verrebbe prima di U).
    const { rows } = await this.pool.query<Candidato>(
      `SELECT r.id AS "richiestaId",
              pa.nome || ' ' || pa.cognome AS paziente,
              pa.telefono,
              r.classe_priorita AS "classePriorita",
              to_char(r.data_richiesta, 'YYYY-MM-DD') AS "dataRichiesta",
              pa.sede_riferimento_id = $2 AS "stessaSede"
         FROM richieste r
         JOIN pazienti pa ON pa.id = r.paziente_id
        WHERE r.stato = 'in_attesa'
          AND r.prestazione_id = $1
        ORDER BY array_position(ARRAY['U', 'B', 'D', 'P'], r.classe_priorita::text),
                 r.data_richiesta,
                 pa.sede_riferimento_id = $2 DESC,
                 r.id
        LIMIT $3`,
      [s.prestazione_id, s.sede_id, limite]);
    return { slotId, candidati: rows };
  }
    // Tempi d'attesa delle prenotazioni attive con appuntamento tra "dal" e "al".
  // Attesa = giorno dell'appuntamento meno giorno della richiesta.
  // Filtri facoltativi: prestazione e classe di priorità.
  // La soglia viene da SoglieAttesa (codice), non dal database: per questo
  // il conteggio entro/fuori si fa qui in TypeScript e non in SQL.
  async tempiAttesa(dal: string, al: string, prestazioneId?: number, classe?: ClassePriorita): Promise<TempiAttesa[]> {
    // Una riga per prenotazione: prestazione, tipo, classe e giorni d'attesa.
    const { rows } = await this.pool.query<{ prestazione: string; tipo: TipoPrestazione; classe: ClassePriorita; attesa: number }>(
      `SELECT pr.nome AS prestazione,
              pr.tipo,
              r.classe_priorita AS classe,
              s.inizio::date - r.data_richiesta AS attesa
         FROM prenotazioni p
         JOIN slot s         ON s.id = p.slot_id
         JOIN richieste r    ON r.id = p.richiesta_id
         JOIN prestazioni pr ON pr.id = r.prestazione_id
        WHERE p.stato <> 'disdetta'
          AND s.inizio >= $1::date
          AND s.inizio <  $2::date + 1
          AND ($3::int IS NULL OR r.prestazione_id = $3)
          AND ($4::text IS NULL OR r.classe_priorita = $4)
        ORDER BY pr.id, array_position(ARRAY['U', 'B', 'D', 'P'], r.classe_priorita::text)`,
      [dal, al, prestazioneId ?? null, classe ?? null]);

    // Raggruppa per prestazione e classe e conta entro/fuori soglia.
    // La Map tiene l'ordine di inserimento, quindi quello della query.
    const gruppi = new Map<string, TempiAttesa>();
    for (const r of rows) {
      const chiave = `${r.prestazione}|${r.classe}`;
      let g = gruppi.get(chiave);
      if (!g) {
        g = {
          prestazione: r.prestazione,
          classePriorita: r.classe,
          sogliaGiorni: SoglieAttesa.giorni(r.classe, r.tipo),
          entroSoglia: 0,
          fuoriSoglia: 0,
        };
        gruppi.set(chiave, g);
      }
      if (r.attesa <= g.sogliaGiorni) g.entroSoglia++;
      else g.fuoriSoglia++;
    }
    return [...gruppi.values()];
  }
}