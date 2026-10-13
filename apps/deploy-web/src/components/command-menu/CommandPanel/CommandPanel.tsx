"use client";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useRef } from "react";
import { Dialog, DialogOverlay, DialogPortal, DialogPrimitiveContent } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

type Props = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  className?: string;
  onCloseAutoFocus?: ComponentPropsWithoutRef<typeof DialogPrimitiveContent>["onCloseAutoFocus"];
  children: ReactNode;
};

const PANEL_CLASSES =
  "fixed inset-x-4 top-[12vh] z-[751] mx-auto flex max-h-[calc(100dvh-12vh-16px)] flex-col overflow-hidden rounded-[14px] border bg-popover text-popover-foreground shadow-[0_30px_70px_-20px_rgba(0,0,0,0.45)] outline-none duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.985] data-[state=open]:slide-in-from-top-1.5";

/** A dialog panel pinned near the top of the screen, as the command menu and the shortcuts sheet are. */
export function CommandPanel({ isOpen, onOpenChange, className, onCloseAutoFocus, children }: Props) {
  const focusedBeforeOpenRef = useRef<Element | null>(null);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitiveContent
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            focusedBeforeOpenRef.current = document.activeElement;
          }}
          onCloseAutoFocus={event => {
            onCloseAutoFocus?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            returnFocusTo(focusedBeforeOpenRef.current);
          }}
          className={cn(PANEL_CLASSES, className)}
        >
          {children}
        </DialogPrimitiveContent>
      </DialogPortal>
    </Dialog>
  );
}

/** Radix only returns the focus to a `Dialog.Trigger`, and these panels also open from keyboard shortcuts. */
function returnFocusTo(element: Element | null) {
  if (element instanceof HTMLElement) element.focus();
}
