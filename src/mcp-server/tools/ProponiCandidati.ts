// Tool proponi_candidati (sola lettura): per uno slot libero, i pazienti in
// lista d'attesa da chiamare, già in ordine. Casi d'uso UC3 e UC4.

import * as z from "zod/v4";
import { RecallTool } from "../RecallTool.ts";

// Parametri di ingresso. Le descrizioni (describe) arrivano al modello
// insieme allo schema: gli spiegano cosa mettere in ogni campo.
const schemaInput = z.object({
  slotId: z.number().int().positive().describe("Numero dello slot libero"),
  limite: z.number().int().min(1).max(10).optional().describe("Quanti candidati restituire (se manca: 5)"),
});

// Forma del risultato: la stessa di CandidatiSlot in tipi.ts.
const schemaOutput = z.object({
  slotId: z.number(),
  candidati: z.array(
    z.object({
      richiestaId: z.number(),
      paziente: z.string(),
      telefono: z.string(),
      classePriorita: z.enum(["U", "B", "D", "P"]),
      dataRichiesta: z.string(),
      stessaSede: z.boolean(),
    }),
  ),
});

export class ProponiCandidati extends RecallTool<typeof schemaInput, typeof schemaOutput> {
  readonly nome = "proponi_candidati";
  readonly descrizione =
    "Per uno slot libero, elenca i pazienti in lista d'attesa per la stessa prestazione, " +
    "già nell'ordine in cui chiamarli: classe di priorità (U, B, D, P), poi data della " +
    "richiesta, poi sede di riferimento. L'ordine è deciso dal sistema e non va cambiato. " +
    "Non modifica i dati.";
  readonly schemaInput = schemaInput;
  readonly schemaOutput = schemaOutput;
  readonly soloLettura = true;

  // Il tipo di ritorno dichiarato fa controllare a TypeScript che il risultato
  // del repository abbia tutti i campi promessi dallo schema di uscita.
  async esegui(args: z.infer<typeof schemaInput>): Promise<z.infer<typeof schemaOutput>> {
    return this.repo.candidatiPerSlot(args.slotId, args.limite);
  }
}
