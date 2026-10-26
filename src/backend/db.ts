import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL non impostata: copia .env.example in .env");
}

// Un solo pool di connessioni per tutto il back-end.
export const pool = new pg.Pool({ connectionString: url });