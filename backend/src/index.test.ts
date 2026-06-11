import { afterAll, beforeAll, expect, test } from "bun:test";

import { createBackendServer } from "./index";

const { httpServer } = createBackendServer();
let baseUrl: string;

// start the server before all tests
beforeAll(async () => {
  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", resolve);
  });

  const { port } = httpServer.address() as { port: number };
  baseUrl = `http://127.0.0.1:${port}`;
});

// close the server after all tests
afterAll(async () => {
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

test("GET /health returns ok", async () => {
  const res = await fetch(`${baseUrl}/health`);

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});
