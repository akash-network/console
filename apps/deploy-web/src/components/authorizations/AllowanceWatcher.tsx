import { FC } from "react";

import { useAllowance } from "@src/hooks/useAllowance";

export const AllowanceWatcher: FC = () => {
  useAllowance();
  return null;
};
