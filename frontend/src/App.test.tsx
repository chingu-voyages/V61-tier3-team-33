/// <reference types="bun" />

import { expect, test } from "bun:test";
// ✅ FIX: Use renderToString instead of renderToStaticMarkup
import { renderToString } from "react-dom/server";

import App from "./App";
import React from "react";

test("App renders", () => {
  const markup = renderToString(<App />);

  expect(markup).toContain("Chess");
});