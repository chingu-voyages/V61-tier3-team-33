import { Elysia } from "elysia";
import config from "./config/config";
import { Gateway } from "./server/transport/gateway";

const gateway = new Gateway();

// Vercel serverless export (Elysia auto-detection + HTTP routes)
export default gateway.appInstance;

// Standalone server (local dev, non-Vercel)
if (!Bun.env.VERCEL) {
  gateway.start(config.port);
}
