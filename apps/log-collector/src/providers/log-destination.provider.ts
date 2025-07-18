import { container } from "tsyringe";

import { ConfigService } from "@src/services/config/config.service";
import { DatadogService } from "@src/services/datadog-destination/datadog.service";

export const LOG_DESTINATION = "LOG_DESTINATION";

container.register(LOG_DESTINATION, {
  useFactory: c => {
    const config = c.resolve(ConfigService);
    const destination = config.get("DESTINATION");

    if (destination === "DATADOG") {
      return c.resolve(DatadogService);
    }

    throw new Error(`DESTINATION "${destination}" is not implemented`);
  }
});
