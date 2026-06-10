import type { FC, ReactNode } from "react";

type Props = {
  id?: string;
  children: ReactNode;
};

/**
 * Validation message shown full-width below an input or card, in muted,
 * small text. Pair `id` with the input's `aria-describedby` for a11y.
 */
export const FieldErrorMessage: FC<Props> = ({ id, children }) => (
  <p id={id} className="text-muted-foreground mt-1 text-sm">
    {children}
  </p>
);
