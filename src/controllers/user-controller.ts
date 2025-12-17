import { Request, Response } from "express";
import { UserRequestDto } from "../models/user-dto";
import { v4 as uuidv4 } from "uuid";
import { dbPool } from "../config/db";
import bcrypt from "bcrypt";

const saltRounds = 10;

const createUser = async (req: Request, res: Response) => {
  const { name, lastName, userName, email, role, password }: UserRequestDto = req.body;
  const newUserId = uuidv4();
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    const checkUser = await client.query(`SELECT * FROM users WHERE email = $1`, [email]);

    if (checkUser.rowCount && checkUser.rowCount > 0) {
      res.status(400).json({ message: "User already exist!" });
    }

    const bcryptPassword = password && (await bcrypt.hash(password, saltRounds));

    await client.query(
      `INSERT INTO "users" (id, name, last_name, user_name, email, role, bcrypt_password) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newUserId, name, lastName, userName, email, role, bcryptPassword],
    );
    await client.query("COMMIT");
    res.status(201).json({ message: "User created successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const updateUser = async (req: Request, res: Response) => {
  const userId = req.params.id;
  const { name, lastName, userName, email, role }: UserRequestDto = req.body;
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE "users" 
                SET name = $1, last_name = $2, email = $3, role = $4, user_name = $5, updated_at = now() 
                WHERE id = $6`,
      [name, lastName, email, role, userName, userId],
    );
    await client.query("COMMIT");
    res.status(200).json({ message: "User updated successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const deleteUser = async (req: Request, res: Response) => {
  const userId = req.params.id;

  const client = await dbPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await client.query("COMMIT");
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const getUserById = async (req: Request, res: Response) => {
  const userId = req.params.id;
  try {
    const dbRes = await dbPool.query(
      `SELECT
                u.id,
                u.name,
                u.last_name AS "lastName",
                u.user_name AS "userName",
                u.email,
                u.role                                 
            FROM users u
            WHERE u.id = $1`,
      [userId],
    );

    if (!dbRes.rowCount || !(dbRes.rowCount > 0)) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const userData = dbRes.rows[0];

    res.json(userData);
  } catch (error) {
    console.log("DB Error: ", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getUsers = async (req: Request, res: Response) => {
  try {
    const userDbRes = await dbPool.query(`
            SELECT 
            u.id, 
            u.name, 
            u.last_name AS "lastName", 
            u.user_name AS "userName", 
            u.email, 
            u.role
        FROM 
            "users" u
        ORDER BY u.created_at DESC`);

    const usersData = userDbRes.rows;

    res.status(200).json(usersData);
  } catch (error: any) {
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export { createUser, updateUser, deleteUser, getUserById, getUsers };
