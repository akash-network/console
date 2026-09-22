import { createContext, useContext } from "react";

/** The deployment a redeploy started from and the secret names its stored values answer for, so rows kept under those names need no value here. */
export interface InheritedSecrets {
  sourceDseq: string;
  names: ReadonlySet<string>;
}

const InheritedSecretsContext = createContext<InheritedSecrets | null>(null);

export const InheritedSecretsProvider = InheritedSecretsContext.Provider;

export function useInheritedSecrets(): InheritedSecrets | null {
  return useContext(InheritedSecretsContext);
}
