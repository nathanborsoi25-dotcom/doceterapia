import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Cliente do banco (Neon Postgres) com inicialização preguiçosa.
 * Só cria a conexão na primeira chamada — assim o `next build` não quebra
 * quando o DATABASE_URL ainda não está disponível. NÃO envolver em Proxy
 * (quebra libs que inspecionam o objeto do banco).
 */
function createDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle(sql, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
