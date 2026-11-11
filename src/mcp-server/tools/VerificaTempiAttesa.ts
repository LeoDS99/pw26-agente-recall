// Tool verifica_tempi_attesa (sola lettura): quante prenotazioni rispettano la
// soglia massima d'attesa della loro classe di priorità e quante la superano.
// Caso d'uso UC5 (responsabile delle liste d'attesa).

import * as z from "zod/v4";
import { NOMI_PRESTAZIONI, idPrestazione } from "../../backend/catalogo.js";
import { GIORNI_PREDEFINITI, dataFinale } from "../date.js";
import { RecallTool } from "../RecallTool.js";

const schemaInput = z.object({
  dal: z.iso.date().describe("Primo giorno di appuntamenti da considerare, formato AAAA-MM-GG"),
  al: z.iso
    .date()
    .optional()
    .describe(`Ultimo giorno compreso, formato AAAA-MM-GG (se manca: ${GIORNI_PREDEFINITI} giorni dopo "dal")`),
  prestazione: z.enum(NOMI_PRESTAZIONI).optional().describe("Solo questa prestazione (se manca: tutte)"),
  classe: z.enum(["U", "B", "D", "P"]).optional().describe("Solo questa classe di priorità (se manca: tutte)"),
});

// Il risultato MCP deve essere un oggetto: l'elenco sta nel campo "tempi".
// Una riga per ogni coppia prestazione e classe di priorità.
const schemaOutput = z.object({
  tempi: z.array(
    z.object({
      prestazione: z.string(),
      classePriorita: z.enum(["U", "B", "D", "P"]),
      sogliaGiorni: z.number(),
      entroSoglia: z.number(),
      fuoriSoglia: z.number(),
    }),
  ),
});

export class VerificaTempiAttesa extends RecallTool<typeof schemaInput, typeof schemaOutput> {
  readonly nome = "verifica_tempi_attesa";
  readonly descrizione =
    "Per le prenotazioni attive con appuntamento tra due date, conta per ogni prestazione e " +
    "classe di priorità quante rispettano la soglia massima d'attesa (entroSoglia) e quante la " +
    "superano (fuoriSoglia). L'attesa è il numero di giorni tra la richiesta e l'appuntamento. " +
    "Soglie: U 3 giorni, B 10, D 30 per le visite e 60 per gli esami, P 120. Non modifica i dati.";
  readonly schemaInput = schemaInput;
  readonly schemaOutput = schemaOutput;
  readonly soloLettura = true;

  async esegui(args: z.infer<typeof schemaInput>): Promise<z.infer<typeof schemaOutput>> {
    // Se "al" manca vale 30 giorni dopo "dal"; un intervallo al contrario è rifiutato.
    const al = dataFinale(args.dal, args.al);
    const prestazioneId = args.prestazione ? idPrestazione(args.prestazione) : undefined;

    return { tempi: await this.repo.tempiAttesa(args.dal, al, prestazioneId, args.classe) };
  }
}
