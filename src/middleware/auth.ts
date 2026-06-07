import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import type { CustomJwtPayload, ROLES } from "../types";

const auth = (...requiredRoles: ROLES[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === "OPTIONS") return next();

    try {
      let token =
        (req.headers.authorization as string) ||
        (req.headers["x-auth-token"] as string);

      if (token && token.startsWith("Bearer ")) {
        token = token.slice(7);
      }

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
      console.error("Auth error:", err);
      next(err);
    }
  };
};

export default auth;
