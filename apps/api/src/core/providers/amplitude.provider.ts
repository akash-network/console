import * as amplitude from "@amplitude/analytics-node";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { CoreConfigService } from "@src/core/services/core-config/core-config.service";

export const AMPLITUDE = "AMPLITUDE";

container.register(AMPLITUDE, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(CoreConfigService);
    amplitude.init(config.get("AMPLITUDE_API_KEY"));
    return amplitude;
  })
});

export type Amplitude = {
  track: typeof amplitude.track;
};
