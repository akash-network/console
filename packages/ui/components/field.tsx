"use client";
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils";
import { Separator } from "./separator";

const FieldSet = React.forwardRef<HTMLFieldSetElement, React.ComponentPropsWithoutRef<"fieldset">>(({ className, ...props }, ref) => (
  <fieldset
    ref={ref}
    data-slot="field-set"
    className={cn("flex flex-col gap-6", "has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3", className)}
    {...props}
  />
));
FieldSet.displayName = "FieldSet";

const fieldLegendVariants = cva("mb-3 font-medium", {
  variants: {
    variant: {
      legend: "text-base",
      label: "text-sm"
    }
  },
  defaultVariants: {
    variant: "legend"
  }
});

const FieldLegend = React.forwardRef<HTMLLegendElement, React.ComponentPropsWithoutRef<"legend"> & VariantProps<typeof fieldLegendVariants>>(
  ({ className, variant = "legend", ...props }, ref) => (
    <legend ref={ref} data-slot="field-legend" data-variant={variant} className={cn(fieldLegendVariants({ variant }), className)} {...props} />
  )
);
FieldLegend.displayName = "FieldLegend";

const FieldGroup = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-group"
    className={cn(
      "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
      className
    )}
    {...props}
  />
));
FieldGroup.displayName = "FieldGroup";

const fieldVariants = cva("group/field data-[invalid=true]:text-destructive flex w-full gap-3", {
  variants: {
    orientation: {
      vertical: "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
      horizontal: [
        "flex-row items-center",
        "[&>[data-slot=field-label]]:flex-auto",
        "has-[>[data-slot=field-content]]:[&>[role=checkbox],&>[role=radio]]:mt-px has-[>[data-slot=field-content]]:items-start"
      ],
      responsive: [
        "@md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto flex-col [&>*]:w-full [&>.sr-only]:w-auto",
        "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
        "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],&>[role=radio]]:mt-px"
      ]
    }
  },
  defaultVariants: {
    orientation: "vertical"
  }
});

const Field = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div"> & VariantProps<typeof fieldVariants>>(
  ({ className, orientation = "vertical", ...props }, ref) => (
    <div ref={ref} role="group" data-slot="field" data-orientation={orientation} className={cn(fieldVariants({ orientation }), className)} {...props} />
  )
);
Field.displayName = "Field";

const FieldContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="field-content" className={cn("group/field-content flex flex-1 flex-col gap-1.5 leading-snug", className)} {...props} />
));
FieldContent.displayName = "FieldContent";

const FieldLabel = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 text-sm font-medium leading-snug",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        "group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
);
FieldLabel.displayName = "FieldLabel";

const FieldTitle = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div">>(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="field-title" className={cn("flex w-fit items-center gap-2 text-sm font-medium leading-snug", className)} {...props} />
));
FieldTitle.displayName = "FieldTitle";

const FieldDescription = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<"p">>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="field-description"
    className={cn(
      "text-muted-foreground text-sm font-normal leading-normal",
      "group-has-[[data-orientation=horizontal]]/field:text-balance",
      "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
      className
    )}
    {...props}
  />
));
FieldDescription.displayName = "FieldDescription";

const FieldSeparator = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<"div"> & { children?: React.ReactNode }>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} data-slot="field-separator" data-content={!!children} className={cn("relative -my-2 h-5 text-sm", className)} {...props}>
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span className="bg-background text-muted-foreground relative mx-auto block w-fit px-2" data-slot="field-separator-content">
          {children}
        </span>
      )}
    </div>
  )
);
FieldSeparator.displayName = "FieldSeparator";

const FieldError = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div"> & {
    errors?: Array<{ message?: string } | undefined>;
  }
>(({ className, children, errors, ...props }, ref) => {
  const content = React.useMemo(() => {
    if (children) return children;
    if (!errors?.length) return null;

    const filtered = errors.filter((e): e is { message?: string } => Boolean(e?.message));
    if (filtered.length === 0) return null;
    if (filtered.length === 1) return filtered[0].message;

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {filtered.map((error, index) => (
          <li key={index}>{error.message}</li>
        ))}
      </ul>
    );
  }, [children, errors]);

  if (!content) return null;

  return (
    <div ref={ref} role="alert" data-slot="field-error" className={cn("text-destructive text-sm font-normal", className)} {...props}>
      {content}
    </div>
  );
});
FieldError.displayName = "FieldError";

export { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet, FieldTitle };
