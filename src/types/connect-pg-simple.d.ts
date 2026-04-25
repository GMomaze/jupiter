declare module 'connect-pg-simple' {
  import session from 'express-session';
  import { Pool } from 'pg';

  interface PgSessionOptions {
    pool?: Pool;
    conString?: string;
    tableName?: string;
    schemaName?: string;
    createTableIfMissing?: boolean;
    pruneSessionInterval?: number | false;
    errorLog?: (error: unknown) => void;
  }

  function connectPgSimple(
    sessionModule: typeof session
  ): new (options?: PgSessionOptions) => session.Store;

  export default connectPgSimple;
}
