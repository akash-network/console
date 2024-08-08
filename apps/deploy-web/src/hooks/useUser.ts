import { useMemo } from "react";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { useStoredAnonymousUser } from "@src/hooks/useStoredAnonymousUser";
import { CustomUserProfile } from "@src/types/user";

export const useUser = (): CustomUserProfile => {
  const { user: registeredUser } = useCustomUser();
  const { user: anonymousUser } = useStoredAnonymousUser();

  return useMemo(() => registeredUser || anonymousUser, [registeredUser, anonymousUser]);
};
