#!/usr/bin/env node
// Gate B query helper — MANAGED ENVIRONMENT ONLY.
// Reads DATABASE_URL exclusively from the process environment (never argv),
// executes exactly one read-only SQL statement given as argv[2], prints rows
// as tab-separated text, exits nonzero on any error.
// The connection string value is never printed; pg errors that might embed
// it are stripped to their message class before output.
import { createRequire } from 'node:module';
const require = createRequire('/app/recovery/checkout/lib/db/package.json');
const { Client } = require('pg');

const sql = process.argv[2];
if (!process.env.DATABASE_URL) {
  console.error('BLOCKED: DATABASE_URL not present in environment');
  process.exit(3);
}
if (!sql || !/^\s*select\b/i.test(sql)) {
  console.error('REFUSED: only single read-only SELECT statements are allowed');
  process.exit(2);
}
const client = new Client({ connectionString: process.env.DATABASE_URL,
                            statement_timeout: 15000, query_timeout: 15000 });
try {
  await client.connect();
  const res = await client.query({ text: sql, rowMode: 'array' });
  for (const row of res.rows) console.log(row.map(v => v === null ? '' : String(v)).join('\t'));
  console.log(`# rows: ${res.rowCount}`);
  process.exit(0);
} catch (e) {
  // print class + sanitized message only; never echo conninfo
  const msg = String(e && e.message || e).replace(/postgres(ql)?:\/\/\S+/gi, '[REDACTED_URL]');
  console.error(`QUERY_ERROR: ${msg}`);
  process.exit(1);
} finally {
  try { await client.end(); } catch {}
}
