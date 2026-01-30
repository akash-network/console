import { z } from "zod";

import { ConfigService } from "./config.service";

describe(ConfigService.name, () => {
  it("returns stored config values", () => {
    const schema = z.object({ FOO: z.string() });
    const service = new ConfigService({ config: { FOO: "bar" } as z.infer<typeof schema> });

    expect(service.get("FOO")).toBe("bar");
  });
});
