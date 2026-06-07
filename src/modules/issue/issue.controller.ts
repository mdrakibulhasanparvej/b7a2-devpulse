import type { Request, Response } from 'express';
import { createIssueIntoDB, deleteIssueFromDB, getAllIssuesFromDB, getSingleIssueFromDB, updateIssueInDB } from './issue.service';
import sendResponse from '../../utility/sendResponse';

export const createIssue = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const reporterId = user.id;

    const result = await createIssueIntoDB(req.body, reporterId);

    sendResponse(res, {
      statusCode: 201,
      success: true,
      message: "Issue created successfully",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create issue";
    sendResponse(res, {
      statusCode: 400,
      success: false,
      message,
    });
  }
};

export const getAllIssues = async (req: Request, res: Response) => {
  try {
    const filters = {
      sort: (req.query.sort as string) || 'newest',
      type: req.query.type as string | undefined,
      status: req.query.status as string | undefined,
    };

    const result = await getAllIssuesFromDB(filters);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Issues retrieved successfully",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve issues";
    sendResponse(res, {
      statusCode: 500,
      success: false,
      message,
    });
  }
};

export const getSingleIssue = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await getSingleIssueFromDB(id);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Issue retrieved successfully",
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Issue not found";
    sendResponse(res, {
      statusCode: 404,
      success: false,
      message,
    });
  }
};


export const updateIssue = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = req.user!;
    const userId = user.id;
    const userRole = user.role;

    const result = await updateIssueInDB(id, userId, userRole, req.body);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Issue updated successfully",
      data: result,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Failed to update issue";
    if (message.includes("still 'open'")) {
      return res.status(409).json({
        success: false,
        message: error.message,
        errors: [error.message],
      });
    }
    if (message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
        errors: [error.message],
      });
    }
    if (message.includes("own") || message.includes("authorized")) {
      return res.status(403).json({
        success: false,
        message: "You have no permission to modify this resource",
        errors: [error.message],
      });
    }
    return res.status(400).json({
      success: false,
      message,
      errors: [message],
    });
  }
};


export const deleteIssue = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await deleteIssueFromDB(id);

    sendResponse(res, {
      statusCode: 200,
      success: true,
      message: "Issue deleted successfully",
      data: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete issue";
    sendResponse(res, {
      statusCode: message === "Issue not found!" ? 404 : 400,
      success: false,
      message,
    });
  }
};