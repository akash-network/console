import type { Provider } from "@nestjs/common";
import murmurhash from "murmurhash";

export type Hasher = { hash: typeof murmurhash.v3 };

export const HashProvider: Provider = {
  provide: "HASHER",
  useValue: { hash: murmurhash.v3 }
};
