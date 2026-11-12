// Tool riassegna_slot (SCRITTURA): prenota uno slot libero per un paziente in
// lista d'attesa. Caso d'uso UC3.
// soloLettura è false: l'harness chiede conferma all'operatore prima di eseguirlo.
// Le regole stanno nel RecallRepository: se lo slot non è libero o la richiesta
// non è in attesa per quella prestazione, il tool risponde con il motivo.

import * as z from "zod/v4";
import { RecallTool } from "../RecallTool.ts";

const schemaInput = z.object({
  slotId: z.number().int().positive().describe("Numero dello slot libero da assegnare"),
  richiestaId: z
    .number()
    .int()
    .positive()
    .describe("Numero della richiesta in lista d'attesa (campo richiestaId di proponi_candidati)"),
});

const schemaOutput = z.object({
  prenotazioneId: z.number().describe("Numero della nuova prenotazione"),
  slotId: z.number(),
  richiestaId: z.number(),
  paziente: z.string(),
  inizio: z.string().describe("Data e ora dell'appuntamento"),
  stato: z.string().describe("Stato della nuova prenotazione"),
});

export class RiassegnaSlot extends RecallTool<typeof schemaInput, typeof schemaOutput> {
  readonly nome = "riassegna_slot";
  readonly descrizione =
    "Prenota uno slot libero per una richiesta in lista d'attesa: crea la prenotazione, già " +
    "confermata, e toglie la richiesta dalla lista. Funziona solo se lo slot è libero e la " +
    "richiesta è in attesa per la stessa prestazione dello slot: altrimenti risponde con il " +
    "motivo del rifiuto, che va riferito all'operatore senza cercare di aggirarlo. MODIFICA i dati.";
  readonly schemaInput = schemaInput;
  readonly schemaOutput = schemaOutput;
  readonly soloLettura = false;

  async esegui(args: z.infer<typeof schemaInput>): Promise<z.infer<typeof schemaOutput>> {
    return this.repo.riassegnaSlot(args.slotId, args.richiestaId);
  }
}
