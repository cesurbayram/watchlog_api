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

export { getAllPages };
