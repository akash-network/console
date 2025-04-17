import murmurhash from "murmurhash";
import { container } from "tsyringe";

export const HASHER = "HASHER";

container.register(HASHER, { useValue: { hash: murmurhash.v3 } });

export type Hasher = { hash: typeof murmurhash.v3 };
