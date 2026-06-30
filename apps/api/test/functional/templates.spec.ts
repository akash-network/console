import { describe, expect, it } from "vitest";

import { app, initDb } from "@src/rest-app";

describe("Templates", () => {
  let isDbInitialized = false;

  const setup = async () => {
    if (isDbInitialized) {
      return;
    }

    await initDb();
    isDbInitialized = true;
  };

  describe("GET /v1/templates/{id} path traversal", () => {
    // An encoded separator (%2F -> "/", %5C -> "\") survives Hono routing as a single segment and is
    // only decoded when the param is read, so the id schema sees the real separator and rejects it
    // with a 400 before any file is read. A double-encoded payload decodes to a literal "%2F"/"%5C"
    // (no separator), so it passes validation and resolves to a missing file -> 404. Either way no
    // file contents leak (CON-428). The schema blocks both "/" and "\", so both are exercised here.
    [
      { encodedId: "..%2F..%2F..%2Fetc%2Fpasswd", expectedStatus: 400 }, // ../../../etc/passwd
      { encodedId: "%2Fetc%2Fpasswd", expectedStatus: 400 }, // /etc/passwd (absolute escape)
      { encodedId: "..%2F..%2Fsecret", expectedStatus: 400 },
      { encodedId: "..%252F..%252Fsecret", expectedStatus: 404 }, // double-encoded: stays a literal "%2F"
      { encodedId: "..%5C..%5Csecret", expectedStatus: 400 }, // ..\..\secret (backslash separator)
      { encodedId: "..%255C..%255Csecret", expectedStatus: 404 } // double-encoded: stays a literal "%5C"
    ].forEach(({ encodedId, expectedStatus }) => {
      it(`rejects traversal attempt "${encodedId}" with ${expectedStatus} and no leaked file contents`, async () => {
        await setup();

        const response = await app.request(`/v1/templates/${encodedId}`, {
          method: "GET",
          headers: new Headers({ "Content-Type": "application/json" })
        });

        expect(response.status).toBe(expectedStatus);
        const body = await response.text();
        expect(body).not.toContain("root:x:"); // /etc/passwd marker — proves no file contents are returned
      });
    });
  });
});
