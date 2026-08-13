-- Catalog snapshot for parity comparison
\pset format unaligned
\pset tuples_only on

SELECT '== TABLES ==';
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;

SELECT '== COLUMNS ==';
SELECT table_name||'|'||ordinal_position||'|'||column_name||'|'||data_type||'|'||coalesce(udt_name,'')||'|'||is_nullable||'|'||coalesce(column_default,'-')
FROM information_schema.columns WHERE table_schema='public'
ORDER BY table_name, ordinal_position;

SELECT '== ENUMS ==';
SELECT t.typname||'|'||e.enumsortorder||'|'||e.enumlabel
FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
ORDER BY t.typname, e.enumsortorder;

SELECT '== INDEXES ==';
SELECT indexname||'|'||indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname;

SELECT '== CONSTRAINTS ==';
SELECT rel.relname||'|'||con.conname||'|'||con.contype||'|'||pg_get_constraintdef(con.oid)
FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid
JOIN pg_namespace n ON n.oid=rel.relnamespace WHERE n.nspname='public'
ORDER BY rel.relname, con.conname;

SELECT '== SEQUENCES ==';
SELECT sequencename FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename;

SELECT '== SERIAL BINDING ==';
SELECT c.relname||'.'||a.attname||' -> '||coalesce(pg_get_serial_sequence(c.relname, a.attname),'-')
FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
  AND pg_get_serial_sequence(c.relname, a.attname) IS NOT NULL
ORDER BY 1;
