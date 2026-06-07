import app from "../src/app";
import { initDB } from "../src/db";

initDB();

export default function handler(req: unknown, res: unknown) {
  return app(req, res);
}
