import { describe, expect, it } from "vitest";

import { notFoundOnMalformedId } from "./notFoundOnMalformedId";

describe(notFoundOnMalformedId.name, () => {
  it("renders the not found page when the api rejects the id as malformed", () => {
    expect(() => notFoundOnMalformedId(new Response(null, { status: 400 }))).toThrow(/;404$/);
  });

  it.each([200, 404, 500, 502])("lets the page handle a %i response", status => {
    expect(() => notFoundOnMalformedId(new Response(null, { status }))).not.toThrow();
  });
});
