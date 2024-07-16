import { atom } from "jotai/index";

import type { ApiWalletOutput } from "@src/queries/useFiatWalletQuery";

export const fiatWalletStore = atom<ApiWalletOutput | undefined>(undefined);
