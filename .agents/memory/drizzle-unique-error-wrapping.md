---
name: Drizzle unique-error wrapping
description: How duplicate PostgreSQL errors surface through the Drizzle node-postgres adapter
---

When a PostgreSQL unique constraint is used as the authoritative race guard, do not assume the route catch block receives a top-level `code === "23505"`.

**Why:** Drizzle wraps node-postgres query failures, and the duplicate code/details may be nested under a cause or represented only in the wrapped message. A concurrent duplicate can otherwise become an HTTP 500 even though the database correctly rejected it.

**How to apply:** For user-facing duplicate conflicts, inspect nested causes and stable constraint/message markers, then return the endpoint's documented `409` response. Keep the preflight lookup for friendly sequential errors, but rely on the unique constraint for concurrent correctness.