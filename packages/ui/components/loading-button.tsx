"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "../utils/cn";
import type { ButtonProps } from "./button";
import { Button } from "./button";

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingIndicator?: React.ReactNode;
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ className, children, loading = false, loadingIndicator, disabled, ...props }, ref) => {
    // `disabled` is destructured out of `props` so it is NOT re-applied by `{...props}` below, which would
    // clobber this combined value. A loading button must always block clicks, even when the caller passes
    // `disabled={false}` (e.g. having moved its in-flight flag into `loading`).
    return (
      <Button className={cn(className)} disabled={loading || disabled} ref={ref} {...props}>
        <div className="flex items-center">
          <AnimatePresence mode="popLayout">
            {loading && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {loadingIndicator || <ButtonSpinner />}
              </motion.div>
            )}
          </AnimatePresence>
          {children}
        </div>
      </Button>
    );
  }
);

LoadingButton.displayName = "LoadingButton";

/**
 * Default in-button spinner: a ring tinted with the button's own foreground color via `border-current`, so it
 * stays visible on every variant. The shared `Spinner`'s arc is `fill-primary`, which equals `bg-primary` and
 * vanishes on solid buttons; the button's foreground is guaranteed to contrast its background by design.
 */
function ButtonSpinner() {
  return (
    <span role="status" className="mr-2 flex items-center justify-center">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      <span className="sr-only">Loading...</span>
    </span>
  );
}

export { LoadingButton };
