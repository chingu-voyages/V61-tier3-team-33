/// <reference types="bun" />

import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import App from "./App";

test("App renders", () => {
  const markup = renderToStaticMarkup(<App />);

  expect(markup).toContain("Chess");
});
