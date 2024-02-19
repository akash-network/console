"use client";
import * as React from "react";
import { cn } from "@src/utils/styleUtils";
import { FormControl, FormDescription, FormItem, FormLabel } from "./form";
import { useEffect, useImperativeHandle, useRef, useState } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
      <label>{label}</label>
      {/* <FormControl> */}
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
  label: string;
  startIcon?: React.ReactNode;
  endIcon: React.ReactNode;
  error?: string;
}

const InputWithIcon = React.forwardRef<HTMLInputElement, InputWithIconProps>(({ className, type, label, startIcon, endIcon, error, ...props }, ref) => {
  return (
    <div>
      <label htmlFor={`${label}-input`} className="block text-sm font-medium leading-6 text-gray-900">
        {label}
      </label>
      <div className="relative mt-2 rounded-md shadow-sm">
        {startIcon && <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">{startIcon}</div>}
        <input
          id={`${label}-input`}
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          {...props}
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">{endIcon}</div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" id={`${label}-error`}>
          {error}
        </p>
      )}
    </div>
  );
});
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
        "flex h-10 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
