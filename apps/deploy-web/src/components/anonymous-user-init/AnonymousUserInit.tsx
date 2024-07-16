import { FC } from "react";

import { useAnonymousUser } from "@src/hooks/useAnonymousUser";

export const AnonymousUserInit: FC = () => {
  useAnonymousUser();

  return null;
};
