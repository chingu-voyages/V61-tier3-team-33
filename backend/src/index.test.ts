import { expect, test } from "bun:test";

import app from "./index";

test("GET /health returns ok", async () => {
  const res = await app.fetch(new Request("http://localhost/health"));

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});
