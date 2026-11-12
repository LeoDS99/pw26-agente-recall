// Tool appuntamenti_da_confermare (sola lettura): le prenotazioni dei prossimi
// giorni che nessuno ha ancora confermato. È la lista delle telefonate del
// giro di conferme. Caso d'uso UC1.

import * as z from "zod/v4";
import { NOMI_SEDI, idSede } from "../../backend/catalogo.ts";
import { RecallTool } from "../RecallTool.ts";

const schemaInput = z.object({
  giorni: z.number().int().min(1).max(14).describe("Quanti giorni guardare, a partire da domani (1 = solo domani)"),
  sede: z.enum(NOMI_SEDI).optional().describe("Solo questa sede (se manca: tutte)"),
});

// Il risultato MCP deve essere un oggetto: l'elenco sta nel campo "appuntamenti".
const schemaOutput = z.object({
  appuntamenti: z.array(
    z.object({
      prenotazioneId: z.number(),
      paziente: z.string(),
      telefono: z.string(),
      prestazione: z.string(),
      sede: z.string(),
      inizio: z.string(),
    }),
  ),
});

export class AppuntamentiDaConfermare extends RecallTool<typeof schemaInput, typeof schemaOutput> {
  readonly nome = "appuntamenti_da_confermare";
  readonly descrizione =
    "Elenca le prenotazioni dei prossimi giorni (da domani) non ancora confermate, " +
    "con paziente e telefono, in ordine di data e ora. Serve per sapere chi chiamare " +
    "nel giro di conferme. Non modifica i dati.";
  readonly schemaInput = schemaInput;
  readonly schemaOutput = schemaOutput;
  readonly soloLettura = true;

  async esegui(args: z.infer<typeof schemaInput>): Promise<z.infer<typeof schemaOutput>> {
    const sedeId = args.sede ? idSede(args.sede) : undefined;
    return { appuntamenti: await this.repo.appuntamentiDaConfermare(args.giorni, sedeId) };
  }
}
