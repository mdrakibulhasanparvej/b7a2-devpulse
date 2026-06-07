import { initDB } from "./db";
import app from "./app";
import config from "./config";

initDB();

if (process.env.VERCEL !== "1") {
  app.listen(config.port, () => {
    console.log(`Example app listening on port ${config.port}`);
  });
}

export default app;
