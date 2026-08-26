/**
 * Pure-unit guard (roadmap #12): `@workspace/db` throws at import time when
 * DATABASE_URL is unset. Pure unit suites import modules that re-export the
 * shared db handle but never execute a query (the pg Pool connects lazily),
 * so a placeholder keeps them runnable in database-free CI jobs (e.g. the
 * timezone-dst job). Import this module FIRST, before any `@workspace/db`
 * dependent import. A real DATABASE_URL, when present, is never overridden.
 */
process.env["DATABASE_URL"] ??=
  "postgresql://pure-unit:placeholder@127.0.0.1:9/pure_unit_no_db";
