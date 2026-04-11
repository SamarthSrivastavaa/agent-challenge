import pg from "pg";

/**
 * Creates and returns a connected PostgreSQL client.
 *
 * Uses the DATABASE_URL environment variable. Callers are
 * responsible for calling client.end() when finished.
 */
export async function createDbClient(): Promise<pg.Client> {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  return client;
}

/**
 * Creates a pg.Pool for long-lived connection reuse.
 * Preferred over individual clients for the API server.
 */
export function createDbPool(): pg.Pool {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}
