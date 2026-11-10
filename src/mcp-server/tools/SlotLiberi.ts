// Tool slot_liberi (sola lettura): gli slot ancora liberi in un intervallo di
// date, con filtri facoltativi su prestazione e sede. Caso d'uso UC4.

import * as z from "zod/v4";
import { NOMI_PRESTAZIONI, NOMI_SEDI, idPrestazione, idSede } from "../../backend/catalogo.js";
import { ErroreDominio } from "../../backend/ErroreDominio.js";
import { RecallTool } from "../RecallTool.js";

// Se manca la data finale, si cercano gli slot dei 30 giorni dopo "dal".
const GIORNI_PREDEFINITI = 30;

// z.iso.date() accetta solo date vere nel formato AAAA-MM-GG: il 31 febbraio
// viene rifiutato qui, prima di arrivare al database (scenario 9).
// z.enum(...) accetta solo i nomi presenti nel catalogo.
const schemaInput = z.object({
  dal: z.iso.date().describe("Primo giorno da cercare, formato AAAA-MM-GG"),
  al: z.iso.date().optional()
    .describe(`Ultimo giorno compreso, formato AAAA-MM-GG (se manca: ${GIORNI_PREDEFINITI} giorni dopo "dal")`),
  prestazione: z.enum(NOMI_PRESTAZIONI).optional().describe("Solo questa prestazione (se manca: tutte)"),
  sede: z.enum(NOMI_SEDI).optional().describe("Solo questa sede (se manca: tutte)"),
});

// Il risultato MCP deve essere un oggetto: l'elenco sta nel campo "slot".
const schemaOutput = z.object({
  slot: z.array(z.object({
    slotId: z.number(),
    prestazione: z.string(),
    sede: z.string(),
    inizio: z.string(),
  })),
});

export class SlotLiberi extends RecallTool<typeof schemaInput, typeof schemaOutput> {
  readonly nome = "slot_liberi";
  readonly descrizione =
    "Elenca gli slot ancora liberi (senza prenotazioni attive) tra due date, " +
    "con filtri facoltativi per prestazione e sede. Restituisce solo slot futuri. " +
    "Non modifica i dati.";
  readonly schemaInput = schemaInput;
  readonly schemaOutput = schemaOutput;
  readonly soloLettura = true;

  async esegui(args: z.infer<typeof schemaInput>): Promise<z.infer<typeof schemaOutput>> {
    const al = args.al ?? giorniDopo(args.dal, GIORNI_PREDEFINITI);
    if (al < args.dal) {
      throw new ErroreDominio(`La data finale (${al}) viene prima di quella iniziale (${args.dal}).`);
    }

    // Dai nomi agli id, solo se il filtro c'è.
    const prestazioneId = args.prestazione ? idPrestazione(args.prestazione) : undefined;
    const sedeId = args.sede ? idSede(args.sede) : undefined;

    return { slot: await this.repo.slotLiberi(args.dal, al, prestazioneId, sedeId) };
  }
}

// "2026-11-12" più 30 giorni = "2026-12-12"
function giorniDopo(data: string, giorni: number): string {
  const d = new Date(data);              // una data senza orario è letta come UTC
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);   // di nuovo AAAA-MM-GG
}