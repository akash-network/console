import { container } from "tsyringe";

import { PROCESS_ENV } from "@src/providers/process-env.provider";
import { ConfigService } from "./config.service";

import { seedConfigTestData } from "@test/seeders/config.seeder";

describe("ConfigService", () => {
  it("should provide type-safe access to config values", () => {
    const configData = seedConfigTestData({
      WRITE_TO_CONSOLE: "true",
      DATADOG_DEBUG: "false"
    });

    const config = setup({ env: configData });

    expect(config.get("HOSTNAME")).toBe(configData.HOSTNAME);
    expect(config.get("ENVIRONMENT")).toBe(configData.ENVIRONMENT);
    expect(config.get("WRITE_TO_CONSOLE")).toBe(true);
    expect(config.get("DATADOG_DEBUG")).toBe(false);
    expect(config.getDatadogValue("DD_SITE")).toBe(configData.DD_SITE);
  });

  function setup(input: { env: NodeJS.ProcessEnv }) {
    container.clearInstances();
    container.register(PROCESS_ENV, { useValue: input.env });
    return container.resolve(ConfigService);
  }
});
