"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "../utils";

/**
 * Dialog v2 — a structured modal layout that matches the design system:
 * a header with a bottom border, a scrollable body, and a footer with a top
 * border whose actions are right-aligned. The close (X) button lives in the
 * top-right of the content, aligned with the header.
 *
 * Composed from the same Radix primitives as the original {@link ./dialog}, so
 * `open`/`onOpenChange` and accessibility behave identically. Prefer this when
 * you want the bordered header/footer chrome from the screenshots; reach for the
 * original `dialog` for borderless, centered modals.
 *
 * @example
 * <DialogV2 open={open} onOpenChange={setOpen}>
 *   <DialogV2Content className="max-w-lg">
 *     <DialogV2Header>
 *       <DialogV2Title>Title</DialogV2Title>
 *       <DialogV2Description>Description</DialogV2Description>
 *     </DialogV2Header>
 *     <DialogV2Body>{children}</DialogV2Body>
 *     <DialogV2Footer>
 *       <Button variant="ghost" onClick={onCancel}>Cancel</Button>
 *       <Button onClick={onConfirm}>Confirm</Button>
 *     </DialogV2Footer>
 *   </DialogV2Content>
 * </DialogV2>
 */
const DialogV2 = DialogPrimitive.Root;

const DialogV2Trigger = DialogPrimitive.Trigger;

const DialogV2Portal = DialogPrimitive.Portal;

const DialogV2Close = DialogPrimitive.Close;

const DialogV2Overlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "bg-background/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[750] backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
);
DialogV2Overlay.displayName = "DialogV2Overlay";

/**
 * The modal panel. Lays its children out as a column so a {@link DialogV2Header},
 * {@link DialogV2Body} and {@link DialogV2Footer} stack with the header/footer
 * pinned and the body scrolling. Has no internal padding of its own — each
 * section owns its padding so the header/footer borders run edge to edge.
 */
const DialogV2Content = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideCloseButton?: boolean;
  }
>(({ className, children, hideCloseButton, ...props }, ref) => (
  <DialogV2Portal>
    <DialogV2Overlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "bg-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed left-[50%] top-[50%] z-[751] flex max-h-[85vh] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden border shadow-lg duration-200 sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}

      {!hideCloseButton && (
        <DialogPrimitive.Close className="ring-offset-background data-[state=open]:bg-accent data-[state=open]:text-muted-foreground focus:ring-ring absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogV2Portal>
));
DialogV2Content.displayName = "DialogV2Content";

/**
 * The header section: stacks the title and description and draws the bottom
 * border that separates the header from the body. Reserves right padding so the
 * text never collides with the close button.
 */
const DialogV2Header = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex shrink-0 flex-col space-y-1.5 border-b px-6 py-4 pr-12 text-left", className)} {...props} />
);
DialogV2Header.displayName = "DialogV2Header";

/**
 * The scrollable body section. Holds the main dialog content and grows to fill
 * the space between the header and footer, scrolling when the content overflows.
 */
const DialogV2Body = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex-1 overflow-y-auto px-6 py-4", className)} {...props} />
);
DialogV2Body.displayName = "DialogV2Body";

/**
 * The footer section: draws the top border and right-aligns its actions
 * (primary action last). On narrow viewports the buttons stack with the primary
 * action on top.
 */
const DialogV2Footer = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("bg-muted flex shrink-0 flex-col-reverse justify-end gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:space-x-2", className)}
    {...props}
  />
);
DialogV2Footer.displayName = "DialogV2Footer";

const DialogV2Title = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
DialogV2Title.displayName = "DialogV2Title";

const DialogV2Description = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn("text-muted-foreground text-sm", className)} {...props} />);
DialogV2Description.displayName = "DialogV2Description";

export {
  DialogV2,
  DialogV2Portal,
  DialogV2Overlay,
  DialogV2Close,
  DialogV2Trigger,
  DialogV2Content,
  DialogV2Header,
  DialogV2Body,
  DialogV2Footer,
  DialogV2Title,
  DialogV2Description
};
