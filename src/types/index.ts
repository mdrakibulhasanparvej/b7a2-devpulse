export const USER_ROLE = {
  contributor: "contributor",
  maintainer: "maintainer",
} as const;

export type ROLES = "contributor" | "maintainer";

export interface CustomJwtPayload {
  id: number;
  name: string;
  role: ROLES;
  iat?: number;
  exp?: number;
}