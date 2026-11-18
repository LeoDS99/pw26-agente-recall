import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL non impostata: copia .env.example in .env");
}

// Un solo pool di connessioni per tutto il back-end.
export const pool = new pg.Pool({ connectionString: url });

// Se il database si ferma mentre una connessione del pool è inattiva, pg segnala
// l'errore sul pool. Senza un gestore il processo si chiuderebbe (lo dice la
// documentazione di node-postgres), e con lui il server MCP. Così invece la
// connessione rotta viene scartata, la prossima query ne apre una nuova e il
// dettaglio resta su stderr. Trovato con la prova generale degli scenari (17/11).
pool.on("error", (errore) => {
  console.error("[pool] connessione al database persa:", errore.message);
});
