import { readFile } from "node:fs/promises";
import { pool } from "../db.js";

// Legge schema.sql dalla stessa cartella di questo file e lo esegue.
const sql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");

try {
  await pool.query(sql);
  console.log("Schema applicato: 7 tabelle ricreate vuote.");
} finally {
  await pool.end();
}