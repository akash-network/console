"use client";
import React, { forwardRef, useRef } from "react";
import { X } from "lucide-react";
import type { CustomContentProps, SnackbarKey, VariantType } from "notistack";
import { SnackbarContent, SnackbarProvider } from "notistack";

import { Button } from "../../components/button";
import { Snackbar } from "../../components/custom/snackbar";
import { cn } from "../../utils";

const VARIANT_CLASSES: Record<VariantType, string> = {
  default: "border-border bg-popover",
  info: "border-border bg-popover",
  success: "border-green-100 bg-green-50 dark:border-[hsl(147,100%,12%)] dark:bg-[hsl(150,100%,6%)]",
  warning: "border-amber-100 bg-amber-50 dark:border-[hsl(60,100%,12%)] dark:bg-[hsl(64,100%,6%)]",
  error: "border-red-100 bg-red-50 dark:border-[hsl(357,89%,16%)] dark:bg-[hsl(358,76%,10%)]"
};

const ToastContent = forwardRef<HTMLDivElement, CustomContentProps>(({ id, message, variant, action, style, className }, ref) => (
  <SnackbarContent
    ref={ref}
    role="alert"
    style={style}
    className={cn(
      "text-popover-foreground flex w-full !flex-nowrap items-start gap-2 rounded-lg border p-4 shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
      VARIANT_CLASSES[variant],
      className
    )}
  >
    <div className="min-w-0 flex-1">
      {typeof message === "string" ? <Snackbar title={message} iconVariant={variant === "default" ? undefined : variant} /> : message}
    </div>
    {typeof action === "function" ? action(id) : action}
  </SnackbarContent>
));
ToastContent.displayName = "ToastContent";

export const CustomSnackbarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notistackRef = useRef<SnackbarProvider>(null);
  const onClickDismiss = (key: SnackbarKey) => () => {
    notistackRef.current?.closeSnackbar(key);
  };

  return (
    <SnackbarProvider
      maxSnack={3}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      ref={notistackRef}
      classes={{
        containerRoot: "pb-3 !w-[400px] [&>div]:w-full"
      }}
      Components={{
        default: ToastContent,
        success: ToastContent,
        error: ToastContent,
        warning: ToastContent,
        info: ToastContent
      }}
      action={key => (
        <Button
          onClick={onClickDismiss(key)}
          aria-label="Dismiss"
          size="icon"
          variant="text"
          className="text-muted-foreground hover:text-foreground -mr-1.5 -mt-0.5 h-6 w-6 shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    >
      {children}
    </SnackbarProvider>
  );
};
