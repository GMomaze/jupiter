COPY (
  SELECT
    schemaname,
    relname AS table_name,
    (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', schemaname, relname), false, true, '')))[1]::text::bigint AS row_count
  FROM pg_stat_user_tables
  ORDER BY schemaname, relname
) TO STDOUT WITH CSV HEADER;
