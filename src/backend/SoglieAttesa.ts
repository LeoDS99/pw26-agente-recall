// Soglie massime d'attesa per classe di priorità della ricetta SSN, fissate
// dal Piano nazionale di governo delle liste d'attesa (PNGLA): entro quanti
// giorni dalla richiesta la prestazione va erogata. Fonti complete nell'elaborato.
// Le soglie stanno nel codice e non nel database: sono regole fisse.

import type { ClassePriorita, TipoPrestazione } from "./tipi.ts";

export class SoglieAttesa {
  // Tabella delle soglie in giorni. Solo la classe D cambia tra visite
  // (30) ed esami (60). U = 72 ore, cioè 3 giorni.
  private static readonly GIORNI = {
    U: { visita: 3, esame: 3 },
    B: { visita: 10, esame: 10 },
    D: { visita: 30, esame: 60 },
    P: { visita: 120, esame: 120 },
  } as const;

  // giorni("D", "esame") restituisce 60.
  static giorni(classe: ClassePriorita, tipo: TipoPrestazione): number {
    return SoglieAttesa.GIORNI[classe][tipo];
  }
}
