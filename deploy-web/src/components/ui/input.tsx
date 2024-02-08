"use client";
import * as React from "react";
import { cn } from "@src/utils/styleUtils";
import { FormControl, FormItem, FormLabel } from "./form";

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
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(({ className, type, label, ...props }, ref) => {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          {...props}
        />
      </FormControl>
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

export { FormInput, Input, InputWithIcon };
