import type { ArchiveObjectStore } from "@src/providers/archive.provider";

/**
 * Stateful stand-in for the GCS SDK slice the archive uses, with real generation semantics:
 * save with ifGenerationMatch 0 throws code 412 when the key already exists, download throws
 * code 404 when absent, delete honors ignoreNotFound. Errors carry numeric `code` like the
 * SDK's ApiError so the service's duck-typed detection works unchanged.
 */
export class InMemoryObjectStore implements ArchiveObjectStore {
  readonly objects = new Map<string, Buffer>();
  failNextSaveWith: Error | null = null;
  failNextDownloadWith: Error | null = null;
  failNextDeleteWith: Error | null = null;

  bucket(name: string): ReturnType<ArchiveObjectStore["bucket"]> {
    return {
      file: (key: string) => ({
        save: async (data: Buffer, options: { resumable: boolean; contentType: string; preconditionOpts: { ifGenerationMatch: number } }) => {
          this.#throwInjected("failNextSaveWith");
          const objectKey = `${name}/${key}`;
          if (options.preconditionOpts.ifGenerationMatch === 0 && this.objects.has(objectKey)) {
            throw httpError(412, `object ${objectKey} already exists`);
          }
          this.objects.set(objectKey, Buffer.from(data));
        },
        download: async (): Promise<[Buffer]> => {
          this.#throwInjected("failNextDownloadWith");
          const data = this.objects.get(`${name}/${key}`);
          if (!data) {
            throw httpError(404, `object ${name}/${key} not found`);
          }
          return [data];
        },
        delete: async (options?: { ignoreNotFound?: boolean }) => {
          this.#throwInjected("failNextDeleteWith");
          const objectKey = `${name}/${key}`;
          if (!this.objects.has(objectKey) && !options?.ignoreNotFound) {
            throw httpError(404, `object ${objectKey} not found`);
          }
          this.objects.delete(objectKey);
        }
      })
    };
  }

  #throwInjected(knob: "failNextSaveWith" | "failNextDownloadWith" | "failNextDeleteWith"): void {
    const error = this[knob];
    if (error) {
      this[knob] = null;
      throw error;
    }
  }
}

export function httpError(code: number, message: string): Error {
  return Object.assign(new Error(message), { code });
}
