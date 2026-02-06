import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { dbPool } from "../config/db";

const getRoles = async (req: Request, res: Response) => {
  try {
    const roleDbRes = await dbPool.query(`
            SELECT r.id, r.name FROM role r    
        `);
    const roleData = roleDbRes.rows || [];
    return res.status(200).json(roleData);
  } catch (error) {
    console.error("DB ERROR:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getRoleById = async (req: Request, res: Response) => {
  const roleId = req.params?.id;

  try {
    const roleDbRes = await dbPool.query(`SELECT * FROM role WHERE id = $1`, [roleId]);
    const roleData = roleDbRes.rows[0];
    return res.status(200).json(roleData);
  } catch (error) {
    console.log("DB Error: ", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const createRole = async (req: Request, res: Response) => {
  const { name } = req.body;
  const newRoleId = uuidv4();

  try {
    await dbPool.query(
      `
            INSERT INTO role (id, name)
                VALUES ($1, $2)    
        `,
      [newRoleId, name],
    );
    return res.status(201).json({ message: "Role created successfully" });
  } catch (error: any) {
    console.error("DB ERROR: ", error?.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const updateRole = async (req: Request, res: Response) => {
  const roleId = req.params?.id;
  const { name } = req.body;

  try {
    await dbPool.query(
      `
            UPDATE role SET name=$1 WHERE id=$2     
        `,
      [name, roleId],
    );
    return res.status(200).json({ message: "Role updated successfully" });
  } catch (error: any) {
    console.error("DB ERROR: ", error?.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const deleteRole = async (req: Request, res: Response) => {
  const roleId = req.params?.id;
  try {
    await dbPool.query(
      `
            DELETE FROM role WHERE id = $1    
        `,
      [roleId],
    );
    return res.status(200).json({ message: "Role deleted successfully" });
  } catch (error: any) {
    console.error("DB ERROR:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export { createRole, getRoles, updateRole, getRoleById, deleteRole };
