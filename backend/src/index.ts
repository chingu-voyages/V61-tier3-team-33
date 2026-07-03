import config from "./config/config";
import { Gateway } from "./server/transport/gateway";

const gateway = new Gateway();

// Vercel serverless export (always available, Vercel uses the default export as handler)
export default gateway.appInstance.handle;

// Standalone server (local dev, non-Vercel)
if (!Bun.env.VERCEL) {
  gateway.start(config.port);
}
