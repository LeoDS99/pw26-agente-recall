// Tool registra_esito_contatto (SCRITTURA): salva l'esito di una telefonata su
// una prenotazione e aggiorna il suo stato. Casi d'uso UC1 e UC2.
// soloLettura è false: l'harness chiede conferma all'operatore prima di eseguirlo.

import * as z from "zod/v4";
import { RecallTool } from "../RecallTool.js";

const schemaInput = z.object({
  prenotazioneId: z.number().int().positive().describe("Numero della prenotazione (appuntamento)"),
  esito: z
    .enum(["confermato", "disdetto", "non_raggiungibile"])
    .describe("Esito della telefonata: il paziente conferma, disdice, oppure non ha risposto"),
});

const schemaOutput = z.object({
  prenotazioneId: z.number(),
  esito: z.enum(["confermato", "disdetto", "non_raggiungibile"]),
  statoPrenotazione: z.string().describe("Stato della prenotazione dopo la registrazione"),
  slotLiberato: z.boolean().describe("true se lo slot è tornato libero e si può riassegnare"),
  slotId: z.number().describe("Numero dello slot della prenotazione"),
});

export class RegistraEsitoContatto extends RecallTool<typeof schemaInput, typeof schemaOutput> {
  readonly nome = "registra_esito_contatto";
  readonly descrizione =
    "Registra l'esito di una telefonata su una prenotazione e ne aggiorna lo stato. " +
    "confermato: la prenotazione diventa confermata. disdetto: la prenotazione viene disdetta e " +
    "lo slot torna libero (slotLiberato = true, slotId = lo slot da riassegnare). " +
    "non_raggiungibile: resta da confermare. MODIFICA i dati.";
  readonly schemaInput = schemaInput;
  readonly schemaOutput = schemaOutput;
  readonly soloLettura = false;

  async esegui(args: z.infer<typeof schemaInput>): Promise<z.infer<typeof schemaOutput>> {
    return this.repo.registraEsito(args.prenotazioneId, args.esito);
  }
}
