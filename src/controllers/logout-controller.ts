import { Request, Response } from "express";

const logout = async (req: Request, res: Response) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
    });

    return res.status(200).json({
      message: "Successfully logged out",
      success: true,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message });
  }
};

export { logout };
