import { Ok } from "ts-results";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DataKeyRewrapReport, DataKeyRewrapService } from "@src/secret/services/data-key-rewrap/data-key-rewrap.service";
import { DataKeyRewrapController } from "./data-key-rewrap.controller";

describe(DataKeyRewrapController.name, () => {
  it("hands the target version, the batch size and the dry-run switch to the service", async () => {
    const { controller, dataKeyRewrapService } = setup();

    await controller.rewrapDataKeys({ targetVersion: "3", batchSize: 50, dryRun: true });

    expect(dataKeyRewrapService.rewrapDataKeys).toHaveBeenCalledWith({ targetVersion: "3", batchSize: 50, dryRun: true });
  });

  it("leaves the batch size for the service to default when the operator gives none", async () => {
    const { controller, dataKeyRewrapService } = setup();

    await controller.rewrapDataKeys({ targetVersion: "3", dryRun: false });

    expect(dataKeyRewrapService.rewrapDataKeys).toHaveBeenCalledWith({ targetVersion: "3", dryRun: false });
  });

  it("returns the run's result, so a failed run reaches the command's exit code", async () => {
    const { controller, report } = setup();

    await expect(controller.rewrapDataKeys({ targetVersion: "3", dryRun: false })).resolves.toEqual(Ok(report));
  });

  function setup() {
    const report = mock<DataKeyRewrapReport>({ toVersion: "sdl-secrets.v3", dataKeysRewrapped: 2 });
    const dataKeyRewrapService = mock<DataKeyRewrapService>();
    dataKeyRewrapService.rewrapDataKeys.mockResolvedValue(Ok(report));

    return { controller: new DataKeyRewrapController(dataKeyRewrapService), dataKeyRewrapService, report };
  }
});
