"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { InfoCircle, Lock } from "iconoir-react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";

import { cn } from "../utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { Switch } from "./switch";
import { CustomTooltip, TooltipProvider } from "./tooltip";

export interface CollapsibleCardProps {
  title: string;
  icon: React.ReactNode;
  /** Renders a lock glyph in the header to mark the card read-only (e.g. while quotes are active). */
  locked?: boolean;
  /**
   * Optional help content shown in a tooltip behind an info icon next to the
   * title. Accepts plain text or JSX (e.g. multi-paragraph copy with links).
   */
  infoTooltip?: React.ReactNode;
  /** Optional collapsed-state summary shown on the right of the header. */
  summary?: React.ReactNode;
  /** Optional control rendered in the header (e.g. an enable switch). */
  headerControl?: React.ReactNode;
  /**
   * Turns the card into a non-collapsible action card: the whole header row
   * becomes a button that fires this handler (e.g. to open a modal) instead of
   * expanding, the chevron is dropped, and the body is not rendered.
   */
  onHeaderClick?: () => void;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Drives a built-in enable switch in the header and couples enablement with the
   * expanded state: a disabled card always shows collapsed and clicking either the
   * switch or the header enables and expands it; disabling collapses it; while
   * enabled, the chevron expands/collapses without changing the switch. Omit to
   * render a plain collapsible card with no switch.
   */
  isToggled?: boolean;
  /** Handler for the built-in enable switch. Required for the switch to be interactive. */
  onToggle?: (toggled: boolean) => void;
  /** Accessible label for the built-in enable switch. */
  toggleAriaLabel?: string;
  /** Disables only the built-in enable switch (and enabling via the header); the body and chevron stay interactive. */
  toggleDisabled?: boolean;
  className?: string;
  contentClassName?: string;
  /** The card body. Required for collapsible cards; omitted for `onHeaderClick` action cards. */
  children?: React.ReactNode;
}

/**
 * A collapsible form card: a header with a leading icon, a title, an optional
 * right-aligned control (e.g. an enable switch) and collapsed-summary slot, and
 * a chevron that toggles the body. Defaults to expanded and is always
 * collapsible. Collapsing only hides the body — form-backed inputs keep their
 * value in form state and reappear on expand.
 *
 * The header row and chevron toggle the card; the header control sits over the
 * right of the header as a click-through-padded sibling, so operating it (e.g.
 * toggling a switch) doesn't block the chevron.
 *
 * Pass `isToggled`/`onToggle` to render a built-in enable switch coupled to the
 * collapsed state: a disabled card shows collapsed and clicking the switch or the
 * header enables and expands it; disabling collapses; while enabled the chevron
 * expands/collapses without flipping the switch. Can be driven controlled via
 * `open`/`onOpenChange`.
 *
 * Pass `onHeaderClick` to render a non-collapsible action card instead: the
 * header row acts as a button that fires the handler (e.g. opening a modal) and
 * the body is dropped.
 */
const CollapsibleCard = React.forwardRef<HTMLDivElement, CollapsibleCardProps>(({ onHeaderClick, ...props }, ref) => {
  if (onHeaderClick) {
    const { title, icon, infoTooltip, summary, className, isToggled, onToggle, toggleAriaLabel, toggleDisabled, locked } = props;
    return (
      <ActionCard
        title={title}
        icon={icon}
        infoTooltip={infoTooltip}
        summary={summary}
        onHeaderClick={onHeaderClick}
        className={className}
        isToggled={isToggled}
        onToggle={onToggle}
        toggleAriaLabel={toggleAriaLabel}
        toggleDisabled={toggleDisabled}
        locked={locked}
      />
    );
  }

  return <CollapsibleCardBody ref={ref} {...props} />;
});
CollapsibleCard.displayName = "CollapsibleCard";

const CollapsibleCardBody = React.forwardRef<HTMLDivElement, Omit<CollapsibleCardProps, "onHeaderClick">>(
  (
    {
      title,
      icon,
      locked,
      infoTooltip,
      summary,
      headerControl,
      defaultOpen = true,
      open: openProp,
      onOpenChange,
      isToggled,
      onToggle,
      toggleAriaLabel,
      toggleDisabled = false,
      className,
      contentClassName,
      children
    },
    ref
  ) => {
    const hasToggle = isToggled !== undefined;
    const [uncontrolledExpanded, setUncontrolledExpanded] = useState(hasToggle ? !!isToggled && defaultOpen : defaultOpen);
    const expanded = openProp ?? uncontrolledExpanded;
    // Normally a toggle card's body is gated by its enabled state. While `toggleDisabled` the switch
    // can't change that state, so the chevron drives the body directly — collapse always stays usable.
    const open = hasToggle && !toggleDisabled ? !!isToggled && expanded : expanded;
    const wasToggled = useRef(isToggled);

    useEffect(() => {
      if (isToggled && !wasToggled.current) {
        setUncontrolledExpanded(true);
        onOpenChange?.(true);
      }
      wasToggled.current = isToggled;
    }, [isToggled, onOpenChange]);

    const setExpanded = (next: boolean) => {
      setUncontrolledExpanded(next);
      onOpenChange?.(next);
    };

    const handleHeaderToggle = (nextOpen: boolean) => {
      if (hasToggle && !isToggled && !toggleDisabled) {
        onToggle?.(true);
        return;
      }
      setExpanded(nextOpen);
    };

    const handleEnableToggle = (checked: boolean) => {
      if (toggleDisabled) return;
      onToggle?.(checked);
      if (!checked) {
        setExpanded(false);
      }
    };

    const triggerLabel = open ? `Collapse ${title}` : `Expand ${title}`;
    const control = hasToggle ? (
      <Switch size="sm" aria-label={toggleAriaLabel} checked={isToggled} onCheckedChange={handleEnableToggle} disabled={toggleDisabled} />
    ) : (
      headerControl
    );

    return (
      <Collapsible
        ref={ref}
        open={open}
        onOpenChange={handleHeaderToggle}
        className={cn("bg-card w-full rounded-lg border border-zinc-300 dark:border-zinc-700", className)}
      >
        <div className="relative flex h-12 items-center px-4">
          <CollapsibleTrigger
            aria-label={triggerLabel}
            className="focus-visible:ring-ring flex flex-1 items-center gap-2 self-stretch rounded outline-none focus-visible:ring-1"
          >
            <CardIcon icon={icon} />
            <CardTitle title={title} infoTooltip={infoTooltip} locked={locked} />
            {!open && summary && <CardSummary summary={summary} />}
            <span className="text-foreground flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </CollapsibleTrigger>
          {control && <CardHeaderControl>{control}</CardHeaderControl>}
        </div>
        <CollapsibleContent className={cn("flex flex-col gap-4 px-4", contentClassName, open && children && "pb-4")}>{children}</CollapsibleContent>
      </Collapsible>
    );
  }
);
CollapsibleCardBody.displayName = "CollapsibleCardBody";

/**
 * Non-collapsible variant: the header row fires `onHeaderClick` (e.g. to open a
 * modal) instead of expanding a body. The optional info tooltip stops event
 * propagation, so opening it doesn't fire the handler.
 *
 * Pass `isToggled`/`onToggle` to add a header enable switch (same control the
 * collapsible variant uses). The switch sits as a sibling of the clickable
 * region, so it toggles independently without firing `onHeaderClick`.
 */
const ActionCard: React.FC<
  Pick<
    CollapsibleCardProps,
    "title" | "icon" | "infoTooltip" | "summary" | "className" | "isToggled" | "onToggle" | "toggleAriaLabel" | "toggleDisabled" | "locked"
  > & {
    onHeaderClick: () => void;
  }
> = ({ title, icon, infoTooltip, summary, onHeaderClick, className, isToggled, onToggle, toggleAriaLabel, toggleDisabled = false, locked }) => {
  const content = (
    <>
      <CardIcon icon={icon} />
      <CardTitle title={title} infoTooltip={infoTooltip} locked={locked} />
      {summary && <CardSummary summary={summary} />}
    </>
  );

  if (isToggled === undefined) {
    return (
      <button
        type="button"
        onClick={onHeaderClick}
        className={cn(
          "bg-card focus-visible:ring-ring flex h-12 w-full items-center gap-2 rounded-lg border border-zinc-300 px-4 text-left outline-none focus-visible:ring-1 dark:border-zinc-700",
          className
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={cn("bg-card flex h-12 w-full items-center gap-2 rounded-lg border border-zinc-300 px-4 dark:border-zinc-700", className)}>
      <button
        type="button"
        onClick={onHeaderClick}
        className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 self-stretch rounded text-left outline-none focus-visible:ring-1"
      >
        {content}
      </button>
      <Switch size="sm" aria-label={toggleAriaLabel} checked={isToggled} onCheckedChange={onToggle} disabled={toggleDisabled} />
      <button
        type="button"
        onClick={onHeaderClick}
        aria-label="Open settings"
        className="text-foreground focus-visible:ring-ring flex h-6 w-6 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-1"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

const CardIcon: React.FC<{ icon: React.ReactNode }> = ({ icon }) => (
  <span className="text-foreground flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
    {icon}
  </span>
);

const CardTitle: React.FC<{ title: string; infoTooltip?: React.ReactNode; locked?: boolean }> = ({ title, infoTooltip, locked }) => (
  <div className="flex flex-1 items-center gap-2">
    <span className="text-foreground truncate text-left text-base font-semibold">{title}</span>
    {locked && <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-label="Locked" />}
    {infoTooltip && <CardInfoTooltip>{infoTooltip}</CardInfoTooltip>}
  </div>
);

/**
 * The header info icon. Sits inside the collapse trigger, so it stops pointer and
 * click events from bubbling — opening the tooltip must not toggle the card. Wraps
 * its own `TooltipProvider` so the card works without the consumer providing one.
 */
const CardInfoTooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="flex items-center" onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} role="presentation">
    <TooltipProvider>
      <CustomTooltip title={children} className="text-muted-foreground max-w-[260px] p-3 text-left font-sans text-xs normal-case">
        <InfoCircle className="text-muted-foreground h-4 w-4 cursor-help" aria-label="More information" />
      </CustomTooltip>
    </TooltipProvider>
  </span>
);

/**
 * Renders the header control (e.g. the enable switch) layered over the right of
 * the header, before the chevron. The wrapper is click-through
 * (`pointer-events-none`) so its reserved padding doesn't swallow chevron clicks,
 * while the control itself stays interactive — letting the switch and the
 * collapse chevron be operated independently.
 */
const CardHeaderControl: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="pointer-events-none absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center pr-8">
    <div className="pointer-events-auto flex items-center">{children}</div>
  </div>
);

const CardSummary: React.FC<{ summary: React.ReactNode }> = ({ summary }) => (
  <span className="text-muted-foreground max-w-[150px] truncate text-sm">{summary}</span>
);

export { CollapsibleCard };
