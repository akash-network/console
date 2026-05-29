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
    // Encoded path-traversal payloads: %2F survives Hono routing as a single segment and
    // is decoded to "/" before reaching the handler, so an unguarded endpoint would escape
    // the template cache directory. All of these must resolve to a plain 404, never leaking
    // file contents (CON-428).
    [
      "..%2F..%2F..%2Fetc%2Fpasswd", // ../../../etc/passwd
      "%2Fetc%2Fpasswd", // /etc/passwd (absolute escape)
      "..%2F..%2Fsecret",
      "..%252F..%252Fsecret" // double-encoded: must not be decoded into a separator
    ].forEach(encodedId => {
      it(`responds 404 for traversal attempt "${encodedId}"`, async () => {
        await setup();

        const response = await app.request(`/v1/templates/${encodedId}`, {
          method: "GET",
          headers: new Headers({ "Content-Type": "application/json" })
        });

        expect(response.status).toBe(404);
      });
    });
  });
});
