import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { StreamStatusMessage } from "@src/types/stream-status";

export interface ProviderStreamFactory {
  openStatusStream(hostUri: string, signal: AbortSignal): AsyncIterable<StreamStatusMessage>;
}

export const PROVIDER_STREAM_FACTORY: InjectionToken<ProviderStreamFactory> = Symbol("PROVIDER_STREAM_FACTORY");

container.register(PROVIDER_STREAM_FACTORY, {
  useFactory: instancePerContainerCachingFactory(
    () =>
      ({
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        async *openStatusStream() {}
      }) satisfies ProviderStreamFactory
  )
});
