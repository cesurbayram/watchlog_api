import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ON_PREM_SECRET } from "../config/on-prem-config.js";

const auth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header("Authorization")?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    const decode = jwt.verify(token, ON_PREM_SECRET);
    //req.user = decode;
    next();
  } catch (error) {
    return res.status(400).json({ error: "Invalid Token" });
  }
};

export default auth;
