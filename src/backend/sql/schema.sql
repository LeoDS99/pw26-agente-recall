-- Schema del database del Gruppo Sanitario Collemare (dati sintetici).
-- Cancella e ricrea tutte le tabelle: si lancia prima di ogni seed.

BEGIN;

DROP TABLE IF EXISTS contatti, prenotazioni, richieste, slot, pazienti, prestazioni, sedi;

CREATE TABLE sedi (
  id       serial PRIMARY KEY,
  nome     text NOT NULL,
  localita text NOT NULL
);

CREATE TABLE prestazioni (
  id            serial PRIMARY KEY,
  nome          text NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('visita', 'esame')),
  durata_minuti int  NOT NULL CHECK (durata_minuti > 0)
);

CREATE TABLE pazienti (
  id                  serial PRIMARY KEY,
  nome                text NOT NULL,
  cognome             text NOT NULL,
  telefono            text NOT NULL,
  sede_riferimento_id int  NOT NULL REFERENCES sedi (id)
);

CREATE TABLE slot (
  id             serial PRIMARY KEY,
  sede_id        int       NOT NULL REFERENCES sedi (id),
  prestazione_id int       NOT NULL REFERENCES prestazioni (id),
  inizio         timestamp NOT NULL
);

CREATE TABLE richieste (
  id              serial PRIMARY KEY,
  paziente_id     int     NOT NULL REFERENCES pazienti (id),
  prestazione_id  int     NOT NULL REFERENCES prestazioni (id),
  classe_priorita char(1) NOT NULL CHECK (classe_priorita IN ('U', 'B', 'D', 'P')),
  data_richiesta  date    NOT NULL,
  stato           text    NOT NULL CHECK (stato IN ('in_attesa', 'prenotata', 'annullata'))
);

CREATE TABLE prenotazioni (
  id           serial PRIMARY KEY,
  slot_id      int       NOT NULL REFERENCES slot (id),
  richiesta_id int       NOT NULL UNIQUE REFERENCES richieste (id),
  stato        text      NOT NULL CHECK (stato IN ('da_confermare', 'confermata', 'disdetta')),
  creata_il    timestamp NOT NULL DEFAULT now()
);

CREATE TABLE contatti (
  id              serial PRIMARY KEY,
  prenotazione_id int       NOT NULL REFERENCES prenotazioni (id),
  esito           text      NOT NULL CHECK (esito IN ('confermato', 'disdetto', 'non_raggiungibile')),
  registrato_il   timestamp NOT NULL DEFAULT now()
);

-- Al massimo una prenotazione non disdetta per slot:
-- impedisce le doppie prenotazioni anche se il codice o l'agente sbagliassero.
CREATE UNIQUE INDEX prenotazioni_slot_attiva
  ON prenotazioni (slot_id)
  WHERE stato <> 'disdetta';

COMMIT;