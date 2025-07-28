import { v2 } from "@datadog/datadog-api-client";
import { client } from "@datadog/datadog-api-client";
import { container } from "tsyringe";

import { ConfigService } from "@src/services/config/config.service";

container.register(v2.LogsApi, {
  useFactory: c => {
    const configService = c.resolve(ConfigService);

    const configuration = client.createConfiguration({
      debug: configService.getDatadogValue("DATADOG_DEBUG")
    });
    return new v2.LogsApi(configuration);
  }
});
