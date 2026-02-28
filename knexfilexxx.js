// knexfile.js
import 'dotenv/config';

export default {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 5432,
  },
  migrations: {
    directory: './migrations',
    extension: 'ts',
    loadExtensions: ['.ts']
  }
};