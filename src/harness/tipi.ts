// Tipi di dato dell'harness. Solo dichiarazioni, nessuna logica.

// Un tool come lo vede l'harness: quello che serve per descriverlo al modello
// e per decidere se chiedere conferma all'operatore.
export interface SpecTool {
  nome: string;
  descrizione: string;
  schemaInput: Record<string, unknown>; // JSON Schema dei parametri, così come lo manda il server
  soloLettura: boolean; // true solo se il server lo dichiara esplicitamente
}

// Esito della chiamata di un tool.
export interface EsitoTool {
  testo: string; // il risultato (JSON) o il messaggio d'errore, da passare al modello
  errore: boolean; // true se il tool ha risposto con un errore (isError)
}
