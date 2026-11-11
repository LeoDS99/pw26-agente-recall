// RecallTool: la classe base dei tool del server MCP.
// Ogni tool è una classe che la estende e dichiara:
//  - nome e descrizione: quello che il modello legge per decidere se usarlo;
//  - schemaInput e schemaOutput: la forma dei parametri e del risultato (zod);
//  - soloLettura: false se il tool modifica i dati (serve la conferma dell'operatore);
//  - esegui(): cosa fa, chiamando il RecallRepository.
// I tool sono adattatori: non contengono SQL né regole di dominio.

import type * as z from "zod/v4";
import type { RecallRepository } from "../backend/RecallRepository.js";

// TIn e TOut sono i tipi dei due schemi: così TypeScript controlla che
// esegui() riceva e restituisca dati con la forma dichiarata negli schemi.
export abstract class RecallTool<TIn extends z.ZodObject = z.ZodObject, TOut extends z.ZodObject = z.ZodObject> {
  abstract readonly nome: string;
  abstract readonly descrizione: string;
  abstract readonly schemaInput: TIn;
  abstract readonly schemaOutput: TOut;
  abstract readonly soloLettura: boolean;

  // Il repository arriva da fuori: il tool non sa come ci si collega al database.
  protected readonly repo: RecallRepository;

  constructor(repo: RecallRepository) {
    this.repo = repo;
  }

  // Riceve i parametri già validati dall'SDK e restituisce i dati del risultato.
  // Se una regola di dominio non è rispettata, il repository lancia ErroreDominio.
  abstract esegui(args: z.infer<TIn>): Promise<z.infer<TOut>>;
}
