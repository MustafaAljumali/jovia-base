import { describe, expect, it } from "vitest";

import { scanSecretText } from "./check-secrets.mjs";

describe("secret policy", () => {
  it("detects an OpenSSH private key marker", () => {
    const marker = ["-----BEGIN", "OPENSSH PRIVATE KEY-----"].join(" ");
    expect(scanSecretText(marker)).toContain("OpenSSH private key material");
  });

  it("allows ordinary configuration examples", () => {
    expect(scanSecretText("DATABASE_URL=postgresql://jovia:jovia_local@127.0.0.1/jovia")).toEqual(
      [],
    );
  });
});
