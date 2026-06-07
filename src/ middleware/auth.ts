import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import type { CustomJwtPayload, ROLES } from "../types";

const auth = (...requiredRoles: ROLES[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "OPTIONS") return next();

    try {
      const token = req.headers.authorization;

      // Vercel Log-এ দেখুন কী আসছে
      console.log("TOKEN:", token);
      console.log("SECRET exists:", !!config.secret);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "You are not authorized!",
        });
      }

      const decoded = jwt.verify(
        token,
        config.secret as string,
      ) as CustomJwtPayload;

      if (requiredRoles.length && !requiredRoles.includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message: "You have no permission to access this route",
        });
      }

      req.user = decoded;
      next();
    } catch (err) {
      // আসল error টা দেখুন
      console.error("AUTH ERROR:", err);
      next(err);
    }
  };
};

export default auth;
