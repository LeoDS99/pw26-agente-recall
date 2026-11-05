// Errore di dominio: la richiesta viola una regola del processo (slot che non
// esiste, slot già occupato, richiesta non valida). Il tool lo restituirà al
// modello come messaggio chiaro; gli altri errori (es. database spento) no.
export class ErroreDominio extends Error {}
