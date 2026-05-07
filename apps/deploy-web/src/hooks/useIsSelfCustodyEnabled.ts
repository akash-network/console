import { useFlag } from "@src/hooks/useFlag";

export const SELF_CUSTODY_FLAG = "self_custody" as const;

export const DEPENDENCIES = {
  useFlag
};

export const useIsSelfCustodyEnabled = (dependencies: typeof DEPENDENCIES = DEPENDENCIES): boolean => {
  return dependencies.useFlag(SELF_CUSTODY_FLAG);
};
