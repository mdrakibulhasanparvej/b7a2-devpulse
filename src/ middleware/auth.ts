import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import type { CustomJwtPayload, ROLES } from "../types";

const auth = (...requiredRoles: ROLES[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: "You are not authorized!",
        });
      }

      const token = authHeader.split(' ')[1] as string;
      const decoded = jwt.verify(token, config.secret as string) as CustomJwtPayload;
      
      const role = decoded.role;

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