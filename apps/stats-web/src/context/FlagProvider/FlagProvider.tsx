import type { FC, ReactNode } from "react";

export type Props = { children: ReactNode };

export const FlagProvider: FC<Props> = ({ children }) => {
  return <>{children}</>;
};
