import { Pool } from "pg";

import { DB_DATABASE, DB_HOST, DB_PASSWORD, DB_USER } from "./app-config.js";

export const dbPool = new Pool({
  database: DB_DATABASE,
  host: DB_HOST,
  password: DB_PASSWORD,
  port: 5432,
  user: DB_USER,
  //ssl: true,
});
