import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import config from "../config";
import type { USER_ROLE } from "../types";

type TUserRole = keyof typeof USER_ROLE;

const auth = (...requiredRoles: TUserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization;

      if (!token) {
        return res.status(401).json({
          success: false,
          message: "You are not authorized!",
        });
      }

      const decoded = jwt.verify(token, config.secret as string) as JwtPayload;

      const role = decoded.role as TUserRole;

      if (requiredRoles.length && !requiredRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          message: "You have no permission to access this route",
        });
      }

      req.user = decoded;
      next();
    } catch (err) {
      next(err);
    }
  };
};

export default auth;
