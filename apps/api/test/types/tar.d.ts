import type { HeaderProperties } from "tar";

declare module "tar" {
  /** tar@6 exports `Header` at runtime and encodes `mtime` as a `Date`, but `@types/tar` declares neither. */
  export class Header {
    constructor(props: Omit<HeaderProperties, "mtime"> & { mtime?: Date | null });
    readonly block: Buffer;
    encode(): void;
  }
}
