import type { Request, Response } from 'express';
import sendResponse from "../../utility/sendResponse";
import { createUserIntoDB } from "./user.service";

export const signupUser = async (req: Request, res: Response) => {
  try {
    const result = await createUserIntoDB(req.body);

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "User registered successfully",
      data: result,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    sendResponse(res, {
      statusCode: 400,
      success: false,
      message,
    });
  }
};