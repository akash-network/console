import { container } from "tsyringe";

import { LOG_DESTINATION } from "@src/providers/log-destination.provider";
import { K8sLogCollectorService } from "@src/services/k8s-log-collector/k8s-log-collector.service";
import { LoggerService } from "@src/services/logger/logger.service";
import type { LogDestinationService } from "@src/types/log-destination.interface";
import { bootstrap } from "./main";

import { mockProvider } from "@test/utils/mock-provider.util";

describe("main", () => {
  it("should bootstrap the application and start log collection", async () => {
    const { logCollectorService, logDestinationService } = setup();

    await bootstrap(container);

    expect(logCollectorService.collectLogs).toHaveBeenCalledWith(logDestinationService);
  });

  it("should handle errors during log collection", async () => {
    const { logCollectorService, loggerService } = setup();
    const error = new Error("Log collection failed");
    logCollectorService.collectLogs.mockRejectedValue(error);

    await bootstrap(container);

    expect(loggerService.error).toHaveBeenCalledWith({ error });
  });

  function setup() {
    const loggerService = mockProvider(LoggerService);
    const logCollectorService = mockProvider(K8sLogCollectorService);
    const logDestinationService = mockProvider<LogDestinationService>(LOG_DESTINATION);

    logCollectorService.collectLogs.mockResolvedValue();
    loggerService.setContext.mockReturnValue(undefined);
    loggerService.error.mockReturnValue(undefined);

    return {
      loggerService,
      logCollectorService,
      logDestinationService
    };
  }
});
