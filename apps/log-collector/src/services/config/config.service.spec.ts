import { container } from "tsyringe";

import { PROCESS_ENV } from "@src/providers/nodejs-process.provider";
import { ConfigService } from "./config.service";

import { seedConfigTestData } from "@test/seeders/config.seeder";

describe("ConfigService", () => {
  it("should provide type-safe access to config values", () => {
    const configData = seedConfigTestData({});

    const config = setup({ env: configData });

    expect(config.get("HOSTNAME")).toBe(configData.HOSTNAME);
  });

  function setup(input: { env: NodeJS.ProcessEnv }) {
    container.clearInstances();
    container.register(PROCESS_ENV, { useValue: input.env });
    return container.resolve(ConfigService);
  }
});
