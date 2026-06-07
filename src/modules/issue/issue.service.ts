import { pool } from "../../db";
import type { IIssuePayload, IUpdateIssuePayload } from "./issue.interface";
import type { ROLES } from "../../types";

interface IIssueQueryFilters {
  sort: string;
  type?: string | undefined;
  status?: string | undefined;
}

interface IIssueRow {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  reporter_id: number;
  created_at: string;
  updated_at: string;
}

interface IUserRow {
  id: number;
  name: string;
  role: string;
}

const attachReporter = (issue: IIssueRow, users: IUserRow[]) => {
  const reporter = users.find((u) => u.id === issue.reporter_id);
  const { reporter_id, ...issueData } = issue;
  return {
    ...issueData,
    reporter: reporter || null,
  };
};

export const createIssueIntoDB = async (
  payload: IIssuePayload,
  reporterId: number,
) => {
  const { title, description, type } = payload;

  if (payload.title && payload.title.length > 150) {
    throw new Error("Validation: Title must be 150 characters or less");
  }
  if (payload.description && payload.description.length < 20) {
    throw new Error("Validation: Description must be at least 20 characters");
  }

  const query = `
    INSERT INTO issues (title, description, type, status, reporter_id)
    VALUES ($1, $2, $3, 'open', $4)
    RETURNING *;
  `;

  const values = [title, description, type, reporterId];
  const result = await pool.query(query, values);

  const issue = result.rows[0] as IIssueRow;

  const userQuery = `SELECT id, name, role FROM users WHERE id = $1`;
  const userResult = await pool.query(userQuery, [issue.reporter_id]);
  const users = userResult.rows as IUserRow[];

  return attachReporter(issue, users);
};

export const getAllIssuesFromDB = async (filters: IIssueQueryFilters) => {
  const { sort, type, status } = filters;

  let query = `SELECT * FROM issues WHERE 1=1`;
  const values: string[] = [];

  if (type) {
    values.push(type!);
    query += ` AND type = $${values.length}`;
  }
  if (status) {
    values.push(status!);
    query += ` AND status = $${values.length}`;
  }

  const sortOrder = sort === "oldest" ? "ASC" : "DESC";
  query += ` ORDER BY created_at ${sortOrder}`;

  const result = await pool.query(query, values);
  const issues = result.rows as IIssueRow[];

  if (issues.length === 0) return [];

  const reporterIds = [...new Set(issues.map((issue) => issue.reporter_id))];

  const userQuery = `SELECT id, name, role FROM users WHERE id = ANY($1)`;
  const userResult = await pool.query(userQuery, [reporterIds]);
  const users = userResult.rows as IUserRow[];

  return issues.map((issue) => attachReporter(issue, users));
};

export const getSingleIssueFromDB = async (id: string) => {
  const issueQuery = `SELECT * FROM issues WHERE id = $1`;
  const issueResult = await pool.query(issueQuery, [id]);
  const issue = issueResult.rows[0] as IIssueRow | undefined;

  if (!issue) {
    throw new Error("Issue not found!");
  }

  const userQuery = `SELECT id, name, role FROM users WHERE id = $1`;
  const userResult = await pool.query(userQuery, [issue.reporter_id]);
  const users = userResult.rows as IUserRow[];

  return attachReporter(issue, users);
};

export const updateIssueInDB = async (
  issueId: string,
  userId: number,
  userRole: ROLES,
  payload: IUpdateIssuePayload,
) => {
  const findQuery = `SELECT * FROM issues WHERE id = $1`;
  const findResult = await pool.query(findQuery, [issueId]);
  const existingIssue = findResult.rows[0] as IIssueRow | undefined;

  if (!existingIssue) {
    throw new Error("Issue not found!");
  }

  if (userRole === "contributor") {
    if (existingIssue.reporter_id !== userId) {
      throw new Error("You can only update your own issues!");
    }
    if (existingIssue.status !== "open") {
      throw new Error("You can only update issues that are still 'open'!");
    }
  }

  const { title, description, type, status } = payload;
  const updateQuery = `
    UPDATE issues 
    SET title = COALESCE($1, title), 
        description = COALESCE($2, description), 
        type = COALESCE($3, type),
        status = COALESCE($4, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
  `;

  const values = [title, description, type, status, issueId];
  const result = await pool.query(updateQuery, values);
  const updatedIssue = result.rows[0] as IIssueRow;

  const userQuery = `SELECT id, name, role FROM users WHERE id = $1`;
  const userResult = await pool.query(userQuery, [updatedIssue.reporter_id]);
  const users = userResult.rows as IUserRow[];

  return attachReporter(updatedIssue, users);
};

export const deleteIssueFromDB = async (issueId: string) => {
  const query = `DELETE FROM issues WHERE id = $1 RETURNING id`;
  const result = await pool.query(query, [issueId]);

  if (result.rowCount === 0) {
    throw new Error("Issue not found!");
  }

  return result.rows[0];
};
