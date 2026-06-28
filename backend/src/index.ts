import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import config from "./config";

const app = new Elysia()
  .use(cors({ origin: config.clientUrl }))
  .get("/health", () => ({ status: "ok" }));

export default app;

if (import.meta.main) {
  app.listen(config.port, () => {
    console.log(`♟️ Chess API running at http://localhost:${config.port}`);
  });
}
