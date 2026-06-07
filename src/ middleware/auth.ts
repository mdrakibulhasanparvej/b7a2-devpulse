import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import type { CustomJwtPayload, ROLES } from "../types";

const auth = (...requiredRoles: ROLES[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // ১. ভার্সেল এবং ব্রাউজারের CORS Preflight (OPTIONS) রিকোয়েস্ট সরাসরি বাইপাস করার জন্য
    if (req.method === "OPTIONS") {
      return next();
    }
    try {
      // সরাসরি হেডার থেকে টোকেনটি নিচ্ছি
      const token =
        req.headers.authorization || (req.headers["Authorization"] as string);

      // যদি টোকেন না থাকে, তবে এরর হ্যান্ডেল করছি
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "You are not authorized!",
        });
      }

      // যেহেতু এখানে 'Bearer ' নেই, তাই সরাসরি ভেরিফাই করছি
      const decoded = jwt.verify(
        token,
        config.secret as string,
      ) as CustomJwtPayload;

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
      // টোকেন ভুল বা এক্সপায়ার্ড হলে এখানে আসবে
      next(err);
    }
  };
};

export default auth;
