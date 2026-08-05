import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import { THEME_SCRIPT_HASH } from "@src/lib/csp/csp";
import { AppThemeProvider } from "./AppThemeProvider";

import { render } from "@testing-library/react";

describe("AppThemeProvider", () => {
  it("renders an inline theme script matching the CSP theme script hash", () => {
    const { renderedScriptHash } = setup();

    expect(THEME_SCRIPT_HASH, `the next-themes inline script changed - update THEME_SCRIPT_HASH in lib/csp/csp.ts to ${renderedScriptHash}`).toBe(
      renderedScriptHash
    );
  });

  function setup() {
    const { container } = render(<AppThemeProvider>content</AppThemeProvider>);
    const scriptText = container.querySelector("script")?.textContent ?? "";
    const renderedScriptHash = `'sha256-${crypto.createHash("sha256").update(scriptText, "utf8").digest("base64")}'`;
    return { renderedScriptHash };
  }
});
