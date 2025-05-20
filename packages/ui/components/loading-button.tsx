"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "../utils/cn";
import type { ButtonProps } from "./button";
import { Button } from "./button";
import { Spinner } from "./spinner";

export interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingIndicator?: React.ReactNode;
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(({ className, children, loading = false, loadingIndicator, ...props }, ref) => {
  return (
    <Button className={cn(className)} disabled={loading || props.disabled} ref={ref} {...props}>
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
              {loadingIndicator || <Spinner size="small" className="mr-2" />}
            </motion.div>
          )}
        </AnimatePresence>
        {children}
      </div>
    </Button>
  );
});

LoadingButton.displayName = "LoadingButton";

export { LoadingButton };
