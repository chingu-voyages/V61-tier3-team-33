import cors from "cors";
import express, { type Express } from "express";
import { createServer, type Server as HttpServer } from "node:http";
import config from "./config";

type BackendServer = {
  app: Express;
  httpServer: HttpServer;
};

// create express app
export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: config.clientUrl }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  return app;
}

// create backend server,
// TODO: extend to include web socket
export function createBackendServer(): BackendServer {
  const app = createApp();
  const httpServer = createServer(app);

  return { app, httpServer };
}

// only runs when this file is executed directly, not when imported
if (import.meta.main) {
  const { httpServer } = createBackendServer();

  httpServer.listen(config.port, () => {
    console.log(`♟️ Chess API running at http://localhost:${config.port}`);
  });
}
