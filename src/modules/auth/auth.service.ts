import bcrypt from "bcryptjs";
import { pool } from "../../db";
import jwt from "jsonwebtoken";
import config from "../../config";
import type { ILoginPayload } from "./auth.interface";
export const loginUserFromDB = async (payload: ILoginPayload) => {
  const { email, password } = payload;

  const userQuery = `SELECT * FROM users WHERE email = $1`;
  const result = await pool.query(userQuery, [email]);
  const user = result.rows[0];

  if (!user) {
    throw new Error("User not found!");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);
  if (!isPasswordMatched) {
    throw new Error("Invalid password!");
  }

  const jwtPayload = {
    id: user.id,
    name: user.name,
    role: user.role,
  };

  const accessToken = jwt.sign(jwtPayload, config.secret as string, {
    expiresIn: "10d", 
  });

  const { password: _, ...userWithoutPassword } = user;

  return {
    token: accessToken,
    user: userWithoutPassword,
  };
};