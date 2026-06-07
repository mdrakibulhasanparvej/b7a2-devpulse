import { initDB } from "./db";
import app from "./app";
import config from "./config";

if (process.env.VERCEL !== "1") {
  const main = () => {
    initDB();
    app.listen(config.port, () => {
      console.log(`Example app listening on port ${config.port}`);
    });
  };
  main();
}

export default app;
