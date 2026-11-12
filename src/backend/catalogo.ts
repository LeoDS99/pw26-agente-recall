// Catalogo: le sedi e le prestazioni del Gruppo Sanitario Collemare.
// È l'unico posto in cui sono scritte: il seed le inserisce nel database con
// questi id, i tool del server MCP le usano per riconoscere i nomi e
// tradurli in id. Limite del prototipo: in un sistema reale si leggerebbero
// dal database.

import { ErroreDominio } from "./ErroreDominio.ts";

// Gli id hanno un nome, così nel codice si legge CENTRO invece di 1.
export const CENTRO = 1,
  COSTA = 2,
  VALLE = 3;
export const CARDIOLOGICA = 1,
  OCULISTICA = 2,
  DERMATOLOGICA = 3,
  ECOGRAFIA = 4,
  RISONANZA = 5;

// Le 3 sedi e le prestazioni che ognuna offre (tabella delle sedi in 05).
// "prestazioni" non va nel database: serve al seed per costruire l'agenda,
// cioè per sapere quali slot creare in ogni sede.
export const SEDI = [
  {
    id: CENTRO,
    nome: "Collemare Centro",
    localita: "capoluogo",
    prestazioni: [CARDIOLOGICA, OCULISTICA, DERMATOLOGICA, ECOGRAFIA, RISONANZA],
  },
  {
    id: COSTA,
    nome: "Collemare Costa",
    localita: "paese sul mare",
    prestazioni: [CARDIOLOGICA, OCULISTICA, DERMATOLOGICA, ECOGRAFIA],
  },
  {
    id: VALLE,
    nome: "Collemare Valle",
    localita: "entroterra",
    prestazioni: [CARDIOLOGICA, OCULISTICA, DERMATOLOGICA],
  },
];

// Le 5 prestazioni prenotabili. Il tipo (visita o esame) serve per la soglia
// d'attesa della classe D, che è diversa per visite ed esami.
export const PRESTAZIONI = [
  { id: CARDIOLOGICA, nome: "Visita cardiologica", tipo: "visita", durata: 30 },
  { id: OCULISTICA, nome: "Visita oculistica", tipo: "visita", durata: 20 },
  { id: DERMATOLOGICA, nome: "Visita dermatologica", tipo: "visita", durata: 20 },
  { id: ECOGRAFIA, nome: "Ecografia addome completo", tipo: "esame", durata: 30 },
  { id: RISONANZA, nome: "Risonanza magnetica articolare", tipo: "esame", durata: 45 },
];

// I soli nomi: i tool li usano come valori ammessi nei loro schemi.
export const NOMI_SEDI = SEDI.map((s) => s.nome);
export const NOMI_PRESTAZIONI = PRESTAZIONI.map((p) => p.nome);

// Dal nome all'id, come lo vuole il RecallRepository.
export function idSede(nome: string): number {
  const sede = SEDI.find((s) => s.nome === nome);
  if (!sede) throw new ErroreDominio(`La sede "${nome}" non esiste.`);
  return sede.id;
}

export function idPrestazione(nome: string): number {
  const prestazione = PRESTAZIONI.find((p) => p.nome === nome);
  if (!prestazione) throw new ErroreDominio(`La prestazione "${nome}" non esiste.`);
  return prestazione.id;
}
