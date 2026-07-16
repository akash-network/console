"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronsRight, X } from "lucide-react";

import { cn } from "../../utils";

const bannerVariants = cva("relative flex min-h-[40px] w-full items-center justify-center px-6 py-2 text-center text-sm", {
  variants: {
    variant: {
      error: "bg-destructive text-destructive-foreground",
      warning: "bg-warning text-warning-foreground",
      success: "bg-success text-white",
      info: "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-white",
      neutral: "bg-foreground text-background"
    }
  },
  defaultVariants: {
    variant: "info"
  }
});

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof bannerVariants> {
  /** Renders a trailing dismiss (✕) control. The dismiss click never triggers the banner's own `onClick`. */
  onClose?: () => void;
}

export const Banner = React.forwardRef<HTMLDivElement, BannerProps>(function Banner({ className, variant, onClose, onClick, children, ...props }, ref) {
  const isClickable = !!onClick;

  return (
    <div
      ref={ref}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? activateOnEnterOrSpace : undefined}
      className={cn(bannerVariants({ variant }), isClickable && "cursor-pointer", className)}
      {...props}
    >
      <span className="flex items-center justify-center gap-2">
        {children}
        {isClickable && <ChevronsRight className="h-4 w-4 flex-shrink-0" aria-hidden />}
      </span>

      {onClose && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 rounded-full p-1 opacity-80 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  function dismiss(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onClose?.();
  }
});
Banner.displayName = "Banner";

/**
 * Activates only when the banner itself is the key target. A keydown bubbling up from the dismiss button
 * (or any other interactive child) must not also trigger the banner's `onClick`.
 */
function activateOnEnterOrSpace(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.target !== event.currentTarget) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.currentTarget.click();
  }
}
