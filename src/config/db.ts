import { Pool } from "pg";

export const dbPool = new Pool({
  database: process.env.DB_DATABASE,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: 5432,
  user: process.env.DB_USER,
  //ssl: true,
});
