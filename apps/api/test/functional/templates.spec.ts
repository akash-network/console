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
    // %2F survives Hono routing as a single segment and is only decoded to "/" when the param is
    // read, so the id schema sees the real separator and rejects it with a 400 before any file is
    // read. The double-encoded payload decodes to a literal "%2F" (no separator), so it passes
    // validation and resolves to a missing file -> 404. Either way no file contents leak (CON-428).
    [
      { encodedId: "..%2F..%2F..%2Fetc%2Fpasswd", expectedStatus: 400 }, // ../../../etc/passwd
      { encodedId: "%2Fetc%2Fpasswd", expectedStatus: 400 }, // /etc/passwd (absolute escape)
      { encodedId: "..%2F..%2Fsecret", expectedStatus: 400 },
      { encodedId: "..%252F..%252Fsecret", expectedStatus: 404 } // double-encoded: stays a literal "%2F"
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
