import { container, instancePerContainerCachingFactory } from "tsyringe";

import type { AppInitializer } from "@src/core/providers/app-initializer";
import { APP_INITIALIZER, ON_APP_START } from "@src/core/providers/app-initializer";
import { LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";

/**
 * Puts the sealing key in memory at boot so request paths that wrap a key — signup above all — never
 * reach for it themselves. The fetch is neither awaited nor allowed to reject: `startServer` waits on
 * every initializer and disposes the container when one throws, so an unreachable key service would
 * otherwise stall or abort boot over a key nothing has needed yet.
 *
 * The logger is resolved while the container is still known to be alive, because the rejection it
 * reports can arrive after a different initializer has already had the container disposed — resolving
 * anything from that handler would throw inside it and turn a logged warm-up failure into an
 * unhandled rejection that kills the process and hides the real start-up error.
 */
container.register(APP_INITIALIZER, {
  useFactory: instancePerContainerCachingFactory(c => {
    const logger = c.resolve(LOGGER_FACTORY)({ context: "SDL_SECRETS_SEALING_KEY" });
    const logWarmupFailure = (error: unknown) => logger.error({ event: "SDL_SECRETS_KEY_WARMUP_FAILED", error });

    return {
      async [ON_APP_START]() {
        try {
          void c.resolve(SdlSecretsSealingKeyService).getSealingKey().catch(logWarmupFailure);
        } catch (error) {
          logWarmupFailure(error);
        }
      }
    } satisfies AppInitializer;
  })
});
