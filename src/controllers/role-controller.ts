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
    const roleDbRes = await dbPool.query(
      `SELECT
            r.id,
            r.name,
            JSON_AGG(rp.page_id) AS "selectedPages"
        FROM role r
                LEFT JOIN role_permission rp ON r.id = rp.role_id
        WHERE r.id = $1
        GROUP BY r.id, r.name;`,
      [roleId],
    );
    const roleData = roleDbRes.rows[0];
    return res.status(200).json(roleData);
  } catch (error) {
    console.log("DB Error: ", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const createRole = async (req: Request, res: Response) => {
  const { name, selectedPages }: { name: string; selectedPages: string[] } = req.body;
  const newRoleId = uuidv4();

  const client = await dbPool.connect();
  try {
    await client.query(
      `
            INSERT INTO role (id, name)
                VALUES ($1, $2)    
        `,
      [newRoleId, name],
    );

    // for (const page of selectedPages) {
    //   const newPermissionId = uuidv4();
    //   await client.query(
    //     `
    //         INSERT INTO role_permission (id, role_id, page_id)
    //             VALUES ($1, $2, $3)
    //     `,
    //     [newPermissionId, newRoleId, page],
    //   );
    // }

    await client.query(
      `
        INSERT INTO role_permission (id, role_id, page_id)
        SELECT gen_random_uuid(), $1, unnest($2::uuid[])    
    `,
      [newRoleId, selectedPages],
    );

    return res.status(201).json({ message: "Role created successfully" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("DB ERROR: ", error?.message);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};

const updateRole = async (req: Request, res: Response) => {
  const roleId = req.params?.id;
  const { name, selectedPages }: { name: string; selectedPages: string[] } = req.body;

  const client = await dbPool.connect();

  try {
    await client.query(
      `
        DELETE FROM role_permission WHERE role_id = $1    
    `,
      [roleId],
    );

    await client.query(
      `
            UPDATE role SET name=$1 WHERE id=$2     
        `,
      [name, roleId],
    );

    await client.query(
      `
          INSERT INTO role_permission (id, role_id, page_id)
          SELECT gen_random_uuid(), $1, unnest($2::uuid[])    
      `,
      [roleId, selectedPages],
    );
    return res.status(200).json({ message: "Role updated successfully" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("DB ERROR: ", error?.message);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
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
