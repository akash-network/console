"use client";
import * as React from "react";
import { cn } from "@src/utils/styleUtils";
import { FormControl, FormDescription, FormItem, FormLabel } from "./form";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Label } from "./label";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-popover px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(({ className, type, label, description, ...props }, ref) => {
  return (
    <FormItem>
      {/** TODO */}
      <Label>{label}</Label>
      {/* <FormControl> */}
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-popover px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
      {/* </FormControl> */}
      {description && <FormDescription>{description}</FormDescription>}
    </FormItem>
  );
});
FormInput.displayName = "FormInput";

export interface InputWithIconProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string | React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  error?: string;
  inputClassName?: string;
}

// TODO Variants

const InputWithIcon = React.forwardRef<HTMLInputElement, InputWithIconProps>(
  ({ className, inputClassName, type, label, startIcon, endIcon, error, ...props }, ref) => {
    const id = React.useId();

    return (
      <div className={className}>
        <Label htmlFor={`${id}-input`}>{label}</Label>
        <div className="mt-2 flex h-10 w-full items-center rounded-md border border-input bg-popover px-3 py-2 text-sm shadow-sm ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
          {startIcon && <div className="inset-y-0 left-0 flex items-center">{startIcon}</div>}
          <input
            id={`${id}-input`}
            type={type}
            className={cn(
              "flex-grow file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none",
              // "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              inputClassName,
              { ["pl-4"]: !!startIcon, ["pr-4"]: !!endIcon }
            )}
            ref={ref}
            {...props}
          />
          {endIcon && <div className="inset-y-0 right-0 flex items-center">{endIcon}</div>}
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600" id={`${id}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  }
);
InputWithIcon.displayName = "InputWithIcon";

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
        "flex h-10 w-full resize-y rounded-md border border-input bg-popover px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={textAreaRef}
      onChange={handleChange}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { FormInput, Input, InputWithIcon, Textarea };
