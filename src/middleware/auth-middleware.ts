import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const auth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    const decode = jwt.verify(token, process.env?.SECRET as string);
    req.user = decode;
    next();
  } catch (error) {
    return res.status(400).json({ error: "Invalid Token" });
  }
};

export default auth;
