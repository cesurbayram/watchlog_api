import bcrypt from "bcrypt";
import { Request, Response } from "express";

import { dbPool } from "../config/db";
import { LoginRequestDto } from "../models/auth-dto";
import { UserResponseDto } from "../models/user-dto";
import jwt from "jsonwebtoken";

const login = async (req: Request, res: Response) => {
  const { email, password }: LoginRequestDto = req.body;

  try {
    const userDbRes = await dbPool.query<UserResponseDto>(
      `
        SELECT
        u.id,
        u.name,
        u.last_name AS "lastName",
        u.user_name AS "userName",
        u.email,
        u.role_id AS "roleId",
        r.name AS "roleName",
        u.bcrypt_password as "bcryptPassword",
      COALESCE(JSON_AGG(cup.controller_id) FILTER (WHERE cup.controller_id IS NOT NULL), '[]') AS "controllerIds"
      FROM users u LEFT JOIN role r ON u.role_id=r.id
        LEFT JOIN controller_user_permission cup ON u.id = cup.user_id
      WHERE u.email = $1 GROUP BY u.id, r.name
            `,
      [email],
    );

    if (userDbRes.rowCount === 0) {
      return res.status(400).json({ message: "User does not exist!" });
    }

    const userData = userDbRes.rows[0];
    const isPasswordMatch = await bcrypt.compare(password, userData.bcryptPassword ? userData.bcryptPassword : "");

    if (!isPasswordMatch) {
      return res.status(400).json({ message: "Wrong password!" });
    }

    const tokenData = {
      id: userData.id,
      name: userData.name,
      lastName: userData.lastName,
      userName: userData.userName,
      email: userData.email,
      roleId: userData.roleId,
      roleName: userData.roleName,
      controllerIds: userData.controllerIds,
    };

    const secret = process.env.SECRET;
    if (!secret) {
      throw new Error("SECRET environment variable is not defined");
    }

    const token = jwt.sign(tokenData, secret, {
      expiresIn: 24 * 60 * 60,
    });

    return res.status(200).json({
      message: "User is signed in successfully",
      body: { token, user: userData },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message });
  }
};

export { login };
