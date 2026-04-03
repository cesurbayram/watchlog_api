import { Request, Response } from "express";
import { UserRequestDto } from "../models/user-dto";
import { v4 as uuidv4 } from "uuid";
import { dbPool } from "../config/db";
import { hashPassword } from "../utils/bcrypt-async.js";

const saltRounds = 10;

const createUser = async (req: Request, res: Response) => {
  const { name, lastName, userName, email, role, password, controllerIds }: UserRequestDto = req.body;
  const newUserId = uuidv4();
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    const checkUser = await client.query(`SELECT * FROM users WHERE email = $1`, [email]);

    if (checkUser.rowCount && checkUser.rowCount > 0) {
      return res.status(400).json({ message: "User already exist!" });
    }

    const bcryptPassword = password && (await hashPassword(password, saltRounds));

    await client.query(
      `INSERT INTO "users" (id, name, last_name, user_name, email, role_id, bcrypt_password) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newUserId, name, lastName, userName, email, role, bcryptPassword],
    );

    for (const item of controllerIds) {
      const newUserControllerPermissionId = uuidv4();
      await client.query(
        `INSERT INTO controller_user_permission (id, user_id, controller_id) 
              VALUES ($1, $2, $3)`,
        [newUserControllerPermissionId, newUserId, item],
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({ message: "User created successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
  } finally {
    client.release();
  }
};

const updateUser = async (req: Request, res: Response) => {
  const userId = req.params?.id;
  const { name, lastName, userName, email, role, controllerIds }: UserRequestDto = req.body;
  const client = await dbPool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE "users" 
                SET name = $1, last_name = $2, email = $3, role_id = $4, user_name = $5, updated_at = now() 
                WHERE id = $6`,
      [name, lastName, email, role, userName, userId],
    );
    await client.query(`DELETE FROM controller_user_permission WHERE user_id = $1`, [userId]);

    for (const item of controllerIds) {
      const newUserControllerPermissionId = uuidv4();
      await client.query(
        `INSERT INTO controller_user_permission (id, user_id, controller_id) 
              VALUES ($1, $2, $3)`,
        [newUserControllerPermissionId, userId, item],
      );
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: "User updated successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
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
    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    await client.query("ROLLBACK");
    return res.status(500).json({ message: "Internal Server Error" });
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
                u.role_id,
                COALESCE(JSON_AGG(cu.controller_id) FILTER (WHERE cu.controller_id IS NOT NULL), '[]') AS "controllerIds"                                 
            FROM users u
            LEFT JOIN controller_user_permission cu ON u.id = cu.user_id
            WHERE u.id = $1 GROUP BY u.id`,
      [userId],
    );

    if (!dbRes.rowCount || !(dbRes.rowCount > 0)) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = dbRes.rows[0];

    return res.json(userData);
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
            r.name as role
        FROM 
            "users" u LEFT JOIN role r ON u.role_id = r.id
        ORDER BY u.created_at DESC`);

    const usersData = userDbRes.rows;

    return res.status(200).json(usersData);
  } catch (error: any) {
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export { createUser, updateUser, deleteUser, getUserById, getUsers };
