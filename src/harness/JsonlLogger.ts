// JsonlLogger: il log strutturato dell'harness, in formato JSON Lines.
// Ogni evento è una riga del file con un oggetto JSON, più l'ora in cui è
// avvenuto. Si legge riga per riga, si filtra con qualunque strumento e se il
// programma si interrompe le righe già scritte restano.
// I file vanno nella cartella logs/, esclusa da git: gli estratti per la tesi
// si copiano in una cartella versionata (05, sezione Stack).

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { EventoLog } from "./tipi.ts";

export class JsonlLogger {
  private readonly percorsoFile: string;

  constructor(percorsoFile: string) {
    this.percorsoFile = percorsoFile;
    mkdirSync(dirname(percorsoFile), { recursive: true }); // crea logs/ se non c'è
  }

  // Un file nuovo per ogni avvio, con data e ora locali nel nome:
  // logs/sessione-2026-11-12T12-30-00.jsonl
  static percorsoPredefinito(cartella = "logs"): string {
    // "sv-SE" scrive la data come AAAA-MM-GG HH:MM:SS; ":" non è ammesso nei
    // nomi di file su Windows, quindi diventa "-".
    const ora = new Date().toLocaleString("sv-SE").replace(" ", "T").replaceAll(":", "-");
    return join(cartella, `sessione-${ora}.jsonl`);
  }

  // Scrive l'evento in fondo al file, subito: la scrittura sincrona tiene gli
  // eventi nell'ordine giusto e non perde niente se il programma si ferma.
  registra(evento: EventoLog): void {
    const riga = { ora: new Date().toISOString(), ...evento };
    appendFileSync(this.percorsoFile, JSON.stringify(riga) + "\n", "utf8");
  }
}
