// Tipi di dato del back-end: i valori ammessi e la forma dei risultati
// del RecallRepository. Solo tipi, nessuna logica: li usano il repository,
// SoglieAttesa e, in F3, i tool del server MCP.

// I valori ammessi, gli stessi dei CHECK in schema.sql.
export type ClassePriorita = "U" | "B" | "D" | "P";
export type TipoPrestazione = "visita" | "esame";

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

// I tre esiti possibili di una telefonata (gli stessi del CHECK su contatti).
export type EsitoContatto = "confermato" | "disdetto" | "non_raggiungibile";

// Risultato di registraEsito.
export interface EsitoRegistrato {
  prenotazioneId: number;
  esito: EsitoContatto;
  statoPrenotazione: string;  // stato della prenotazione dopo la registrazione
  slotLiberato: boolean;      // true se lo slot è tornato libero (disdetta)
  slotId: number;
}

// Risultato di riassegnaSlot: la nuova prenotazione.
export interface Riassegnazione {
  prenotazioneId: number;
  slotId: number;
  richiestaId: number;
  paziente: string;
  inizio: string;
  stato: string;
}
