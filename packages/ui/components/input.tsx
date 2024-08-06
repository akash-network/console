"use client";
import * as React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";

import { cn } from "../utils";
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage, useFormField } from "./form";
import { Label } from "./label";

export interface FormInputProps extends InputProps {
  label?: string | React.ReactNode;
  description?: string;
  inputClassName?: string;
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(({ className, inputClassName, type, label, description, ...props }, ref) => {
  const { error } = useFormField();
  return (
    <FormItem className={className}>
      <FormControl>
        <Input type={type} inputClassName={inputClassName} ref={ref} error={!!error} label={label} {...props} />
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
});
FormInput.displayName = "FormInput";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode;
  startIconClassName?: string;
  endIcon?: React.ReactNode;
  endIconClassName?: string;
  error?: boolean;
  inputClassName?: string;
  description?: string;
  label?: string | React.ReactNode;
  isForm?: boolean;
}

// TODO Variants

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, startIconClassName, endIconClassName, inputClassName, type, startIcon, endIcon, error, label, isForm, ...props }, ref) => {
    const id = React.useId();
    const formField = useFormField();

    return (
      <div className={cn("space-y-1", className)}>
        {label && (formField.id ? <FormLabel>{label}</FormLabel> : <Label htmlFor={`${id}-input`}>{label}</Label>)}
        <div className="relative flex items-center">
          {startIcon && <div className={cn("absolute inset-y-0 left-0 flex items-center", startIconClassName)}>{startIcon}</div>}
          <input
            id={`${id}-input`}
            type={type}
            className={cn(
              "border-input bg-popover ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              { ["pl-10"]: !!startIcon, ["pr-10"]: !!endIcon, "ring-destructive ring-2 ring-offset-1": !!error },
              inputClassName
            )}
            ref={ref}
            {...props}
          />
          {endIcon && <div className={cn("absolute inset-y-0 right-0 flex items-center", endIconClassName)}>{endIcon}</div>}
        </div>
      </div>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, onChange, ...props }, ref) => {
  const [value, setValue] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => textAreaRef.current as HTMLTextAreaElement);

  useEffect(() => {
    textAreaRef.current!.style.height = "auto";
    textAreaRef.current!.style.height = textAreaRef.current!.scrollHeight + "px";
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    onChange && onChange(e);
  };

  return (
    <textarea
      className={cn(
        "border-input bg-popover ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full resize-y rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={textAreaRef}
      onChange={handleChange}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { FormInput, Input, Textarea };
