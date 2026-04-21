import { Pool } from "pg";
import {
  ON_PREM_DB_DATABASE,
  ON_PREM_DB_HOST,
  ON_PREM_DB_PASSWORD,
  ON_PREM_DB_USER,
} from "./on-prem-config";

export const dbPool = new Pool({
  database: ON_PREM_DB_DATABASE,
  host: ON_PREM_DB_HOST,
  password: ON_PREM_DB_PASSWORD,
  port: 5432,
  user: ON_PREM_DB_USER,
  //ssl: true,
});
