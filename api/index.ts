import app from "../src/app";
import { initDB } from "../src/db";

initDB();

export default function handler(req: any, res: any) {
  return app(req, res);
}
