// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "./App.js";

afterEach(cleanup);

describe("Jovia shell", () => {
  it("presents the product identity and live status semantically", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/AI operating system/u);
    expect(screen.getByRole("status").textContent).toMatch(/ready/u);
  });
});
