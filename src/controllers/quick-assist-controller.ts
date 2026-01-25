import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

const getQuickAssist = async (req: Request, res: Response) => {
  try {
    const { type, category } = req.query;

    if (type === "categories") {
      const result = await dbPool.query(`
        SELECT id, name, description, created_at
        FROM quick_assist_categories
        ORDER BY name ASC
      `);
      return res.status(200).json(result.rows);
    }

    let query = `
      SELECT id, title, description, content, category, file_path, file_name, 
             file_size, file_type, created_at, updated_at, is_active
      FROM quick_assist_documents
      WHERE is_active = TRUE
    `;

    const params: any[] = [];

    if (category && category !== "all") {
      query += ` AND category = $1`;
      params.push(category);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await dbPool.query(query, params);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error in GET /api/quick-assist:", error);
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
};

const getQuickAssistById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await dbPool.query(
      `SELECT id, title, description, content, category, file_path, file_name, 
             file_size, file_type, created_at, updated_at, is_active
      FROM quick_assist_documents
      WHERE id = $1 AND is_active = TRUE`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error in GET /api/quick-assist/[id]:", error);
    return res.status(500).json({ error: "Failed to fetch document" });
  }
};

const createQuickAssist = async (req: Request, res: Response) => {
  try {
    const { type, name, description, title, content, category } = req.body;

    if (type === "category") {
      if (!name) {
        return res.status(400).json({ error: "Category name is required" });
      }

      try {
        const categoryId = randomUUID();
        const result = await dbPool.query(
          `INSERT INTO quick_assist_categories (id, name, description)
           VALUES ($1, $2, $3)
           RETURNING id, name, description, created_at`,
          [categoryId, name, description],
        );

        return res.status(200).json(result.rows[0]);
      } catch (error: any) {
        if (error.code === "23505") {
          return res.status(400).json({ error: "Category already exists" });
        }
        throw error;
      }
    }

    if (!title || !description || !category) {
      return res.status(400).json({
        error: "Title, description, and category are required",
      });
    }

    const documentId = randomUUID();

    const result = await dbPool.query(
      `INSERT INTO quick_assist_documents 
       (id, title, description, content, category, file_path, file_name, file_size, file_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, title, description, content, category, file_path, file_name, 
                 file_size, file_type, created_at, updated_at, is_active`,
      [documentId, title, description, content || null, category, null, null, null, null],
    );

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error in POST /api/quick-assist:", error);
    return res.status(500).json({ error: "Failed to create document or category" });
  }
};

const updateQuickAssist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, content, category } = req.body;

    const existingResult = await dbPool.query(`SELECT file_path FROM quick_assist_documents WHERE id = $1 AND is_active = TRUE`, [id]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const result = await dbPool.query(
      `UPDATE quick_assist_documents 
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           content = COALESCE($4, content),
           category = COALESCE($5, category),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_active = TRUE
       RETURNING id, title, description, content, category, file_path, file_name, 
                 file_size, file_type, created_at, updated_at, is_active`,
      [id, title, description, content, category],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error in PUT /api/quick-assist/[id]:", error);
    return res.status(500).json({ error: "Failed to update document" });
  }
};

const deleteQuickAssistDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const documentResult = await dbPool.query(`SELECT file_path FROM quick_assist_documents WHERE id = $1 AND is_active = TRUE`, [id]);

    if (documentResult.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    const document = documentResult.rows[0];

    await dbPool.query(
      `UPDATE quick_assist_documents 
       SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_active = TRUE`,
      [id],
    );

    if (document.file_path) {
      const fileName = document.file_path.replace("/uploads/", "");
      const tempDir = os.tmpdir();
      const uploadsDir = path.join(tempDir, "quick-assist-uploads");
      const tempFilePath = path.join(uploadsDir, fileName);
      const publicFilePath = path.join(process.cwd(), "public", "uploads", fileName);

      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        } else if (fs.existsSync(publicFilePath)) {
          fs.unlinkSync(publicFilePath);
        }
      } catch (error) {
        console.warn("Could not delete file:", error);
      }
    }

    return res.status(200).json({ message: "Document deleted successfully" });
  } catch (error: any) {
    console.error("Error in DELETE /api/quick-assist/[id]:", error);
    return res.status(500).json({ error: "Failed to delete document" });
  }
};

const deleteQuickAssistCategory = async (req: Request, res: Response) => {
  try {
    const { type, categoryId } = req.query;

    if (type === "category" && categoryId) {
      const documentsCheck = await dbPool.query(
        `SELECT COUNT(*) as count FROM quick_assist_documents 
         WHERE category = (SELECT name FROM quick_assist_categories WHERE id = $1) 
         AND is_active = TRUE`,
        [categoryId],
      );

      const documentCount = parseInt(documentsCheck.rows[0].count);

      if (documentCount > 0) {
        return res.status(400).json({
          error: `Cannot delete category. It has ${documentCount} documents. Please move or delete them first.`,
        });
      }

      const result = await dbPool.query(
        `DELETE FROM quick_assist_categories 
         WHERE id = $1
         RETURNING name`,
        [categoryId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Category not found" });
      }

      return res.status(200).json({
        message: `Category "${result.rows[0].name}" deleted successfully`,
      });
    }

    return res.status(400).json({ error: "Invalid delete request" });
  } catch (error: any) {
    console.error("Error in DELETE /api/quick-assist:", error);
    return res.status(500).json({ error: "Failed to delete category" });
  }
};

const downloadQuickAssistFile = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    const result = await dbPool.query(
      `SELECT file_path, file_name, file_type
       FROM quick_assist_documents
       WHERE file_path = $1 AND is_active = TRUE`,
      [`/uploads/${filename}`],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "File not found or access denied" });
    }

    const document = result.rows[0];

    const tempDir = os.tmpdir();
    const uploadsDir = path.join(tempDir, "quick-assist-uploads");
    const tempFilePath = path.join(uploadsDir, filename);
    const publicFilePath = path.join(process.cwd(), "public", "uploads", filename);

    let filePath: string | null = null;
    if (fs.existsSync(tempFilePath)) {
      filePath = tempFilePath;
    } else if (fs.existsSync(publicFilePath)) {
      filePath = publicFilePath;
    } else {
      return res.status(404).json({ error: "File not found on disk" });
    }

    const contentType = document.file_type || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${document.file_name}"`);
    res.setHeader("Cache-Control", "no-cache");

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error);
    return res.status(500).json({ error: "Failed to download file" });
  }
};

export {
  getQuickAssist,
  getQuickAssistById,
  createQuickAssist,
  updateQuickAssist,
  deleteQuickAssistDocument,
  deleteQuickAssistCategory,
  downloadQuickAssistFile,
};
