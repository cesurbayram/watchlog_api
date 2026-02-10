import { Request, Response } from "express";
import { dbPool } from "../config/db";

const getAllPages = async (req: Request, res: Response) => {
  try {
    const pageDbRes = await dbPool.query(`
            SELECT * FROM page WHERE link IS NOT NULL ORDER BY "order"    
        `);
    const pageData = pageDbRes.rows;
    return res.status(200).json(pageData);
  } catch (error) {
    console.error("DB ERROR:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const getPermittedPages = async (req: Request, res: Response) => {
  const roleId = req.params?.id;
  try {
    const permittedPageDbRes = await dbPool.query(
      `
            WITH RECURSIVE menu_tree AS (
          SELECT p.id, p.name, p.parent_id, p.link, p.icon_name, p."order"
          FROM page p
          INNER JOIN role_permission rp ON p.id = rp.page_id
          WHERE rp.role_id = $1
          
          UNION
          
          SELECT p.id, p.name, p.parent_id, p.link, p.icon_name, p."order"
          FROM page p
          INNER JOIN menu_tree mt ON p.id = mt.parent_id
      )
      SELECT DISTINCT * FROM menu_tree ORDER BY "order" ASC;
        `,
      [roleId],
    );

    const permittedPageData = permittedPageDbRes.rows;
    return res.status(200).json(permittedPageData);
  } catch (error) {
    console.error("DB ERROR:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export { getAllPages, getPermittedPages };
