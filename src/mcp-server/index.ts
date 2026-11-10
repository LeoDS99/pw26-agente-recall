// Punto di avvio del server MCP: crea il repository, i tool e il server.
// Si lancia con: npx tsx --env-file=.env src/mcp-server/index.ts
// (di solito lo avvia il client: MCP Inspector o l'harness).

import { pool } from '../backend/db.js';
import { RecallRepository } from '../backend/RecallRepository.js';
import { RecallMcpServer } from './RecallMcpServer.js';
import { ProponiCandidati } from './tools/ProponiCandidati.js';
import { SlotLiberi } from './tools/SlotLiberi.js';

const repo = new RecallRepository(pool);

new RecallMcpServer([new ProponiCandidati(repo), new SlotLiberi(repo)]).avvia();