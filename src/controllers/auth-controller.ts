import bcrypt from "bcrypt";

import { dbPool } from "@/config/db.js";

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userDbRes = await dbPool.query(
      `
                SELECT
                    u.id,
                    u.name,
                    u.last_name AS "lastName", 
                    u.user_name AS "userName", 
                    u.email, 
                    u.role,
                    u.bcrypt_password as "bcryptPassword"
                FROM users u WHERE u.email = $1
            `,
      [email],
    );

    if (userDbRes.rowCount === 0) {
      //return NextResponse.json({ message: "User does not exist!" }, { status: 400 });
      res.status(400).json({ message: "User does not exist!" });
    }

    const userData = userDbRes.rows[0];
    const isPasswordMatch = await bcrypt.compare(password, userData.bcryptPassword ? userData.bcryptPassword : "");

    if (!isPasswordMatch) {
      res.status(400).json({ message: "Wrong password!" });
    }

    const tokenData = {
      id: userData.id,
      name: userData.name,
      lastName: userData.lastName,
      userName: userData.userName,
      email: userData.email,
      role: userData.role,
    };

    const secret = process.env.SECRET;
    if (!secret) {
      throw new Error("SECRET environment variable is not defined");
    }

    const token = jwt.sign(tokenData, secret, {
      expiresIn: 24 * 60 * 60,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60,
      sameSite: "lax",
      path: "/",
    });

    res.status(200).json({ message: "Successfully logged in" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
};

export { login };
