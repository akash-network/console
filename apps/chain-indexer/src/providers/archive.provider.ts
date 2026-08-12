import { Storage } from "@google-cloud/storage";
import type { DependencyContainer, InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { APP_CONFIG } from "@src/providers/app-config.provider";

/**
 * The narrow slice of the GCS SDK the archive uses, so tests can hand-roll an in-memory
 * implementation without mocking the SDK's fluent surface.
 */
export interface ArchiveObjectStore {
  bucket(name: string): {
    file(key: string): {
      save(data: Buffer, options: { resumable: boolean; contentType: string; preconditionOpts: { ifGenerationMatch: number } }): Promise<void>;
      download(): Promise<[Buffer]>;
      delete(options?: { ignoreNotFound?: boolean }): Promise<unknown>;
    };
  };
}

/**
 * autoRetry is off because the pipeline's own retry wrappers are the single retry authority;
 * SDK-level retries would multiply attempts and stretch the effective timeout.
 */
const createArchiveStorage = (c: DependencyContainer): ArchiveObjectStore | null =>
  c.resolve(APP_CONFIG).ARCHIVE_BUCKET ? new Storage({ retryOptions: { autoRetry: false }, timeout: 30_000 }) : null;

export const ARCHIVE_STORAGE: InjectionToken<ArchiveObjectStore | null> = Symbol("ARCHIVE_STORAGE");

container.register(ARCHIVE_STORAGE, {
  useFactory: instancePerContainerCachingFactory(createArchiveStorage)
});
