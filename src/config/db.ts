import { Pool } from "pg";

export const dbPool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  port: 5432,
  password: process.env.DB_PASSWORD,
  //ssl: true,
});
