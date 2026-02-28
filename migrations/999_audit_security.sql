-- Force revoke every migration run
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jupiter_app') THEN
        REVOKE DELETE ON audit_log FROM jupiter_app;
        REVOKE UPDATE ON audit_log FROM jupiter_app;
        GRANT SELECT, INSERT ON audit_log TO jupiter_app;
    END IF;
END
$$;