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

// Una richiesta del modello di eseguire un tool, con i parametri che ha scelto.
export interface ChiamataTool {
  nome: string;
  argomenti: Record<string, unknown>;
}

// Un messaggio della conversazione con il modello, nel formato dell'harness:
// non dipende dal fornitore del modello (è il fornitore a tradurlo).
//  - sistema: le istruzioni per il modello (prompt di sistema);
//  - utente: la richiesta dell'operatore;
//  - modello: la risposta del modello, con le eventuali chiamate a tool;
//  - tool: il risultato di un tool, da restituire al modello.
export type Messaggio =
  | { ruolo: "sistema"; testo: string }
  | { ruolo: "utente"; testo: string }
  | { ruolo: "modello"; testo: string; chiamate: ChiamataTool[] }
  | { ruolo: "tool"; nomeTool: string; testo: string };

// Token consumati da una chiamata al modello (servono per il log e per i costi).
export interface UsoToken {
  ingresso: number; // token letti dal modello: istruzioni, conversazione, tool
  uscita: number; // token generati dal modello
}

// La risposta del modello a un turno.
export interface RispostaModello {
  testo: string; // la risposta in linguaggio naturale (può essere vuota se chiede tool)
  chiamate: ChiamataTool[]; // i tool che il modello vuole eseguire; vuoto = risposta finale
  token: UsoToken;
  durataMs: number; // tempo della chiamata al modello, in millisecondi
}
