import { container } from "tsyringe";

import { PROCESS } from "@src/providers/nodejs-process.provider";
import { K8sLogCollectorService } from "@src/services/k8s-log-collector/k8s-log-collector.service";
import { LoggerService } from "@src/services/logger/logger.service";
import { bootstrap } from "./bootstrap";

import { mockProvider } from "@test/utils/mock-provider.util";

describe("bootstrap", () => {
  it("should bootstrap the application and start log collection", async () => {
    const { logCollectorService, loggerService } = setup();

    await bootstrap(container);

    expect(logCollectorService.start).toHaveBeenCalled();
    expect(loggerService.error).not.toHaveBeenCalled();
  });

  it("should handle errors during log collection and exit process", async () => {
    const { logCollectorService, loggerService, process } = setup();
    const error = new Error("Log collection failed");
    logCollectorService.start.mockRejectedValue(error);

    await bootstrap(container);

    expect(loggerService.error).toHaveBeenCalledWith({ error });
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  function setup() {
    const loggerService = mockProvider(LoggerService);
    const logCollectorService = mockProvider(K8sLogCollectorService);
    const process = mockProvider<NodeJS.Process>(PROCESS);

    logCollectorService.start.mockResolvedValue();
    loggerService.setContext.mockReturnValue(undefined);
    loggerService.error.mockReturnValue(undefined);
    process.exit.mockReturnValue(undefined as never);

    return {
      loggerService,
      logCollectorService,
      process
    };
  }
});
