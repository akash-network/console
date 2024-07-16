"use client";
import * as React from "react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";

import { cn } from "../utils";
import { FormControl, FormDescription, FormItem, FormLabel, FormMessage } from "./form";

// export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

// const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
//   return (
//     <input
//       type={type}
//       className={cn(
//         "border-input bg-popover ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
//         className
//       )}
//       ref={ref}
//       {...props}
//     />
//   );
// });
// Input.displayName = "Input";

export interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(({ className, type, label, description, ...props }, ref) => {
  return (
    <FormItem>
      {label && <FormLabel>{label}</FormLabel>}
      <FormControl>
        <Input type={type} className={className} ref={ref} {...props} />
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
});
FormInput.displayName = "FormInput";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  error?: string;
  inputClassName?: string;
  description?: string;
}

// TODO Variants

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, inputClassName, type, startIcon, endIcon, error, ...props }, ref) => {
  return (
    <div
      className={cn(
        "border-input bg-popover ring-offset-background focus:ring-ring flex h-10 w-full items-center rounded-md border px-3 py-2 text-sm shadow-sm focus:ring-2 focus:ring-offset-2",
        { "cursor-not-allowed opacity-50": !!props.disabled, "ring-destructive": !!error },
        className
      )}
    >
      {startIcon && <div className="inset-y-0 left-0 flex items-center">{startIcon}</div>}
      <input
        type={type}
        className={cn(
          "placeholder:text-muted-foreground flex-grow file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          inputClassName,
          { ["pl-4"]: !!startIcon, ["pr-4"]: !!endIcon }
        )}
        ref={ref}
        {...props}
      />
      {endIcon && <div className="inset-y-0 right-0 flex items-center">{endIcon}</div>}
    </div>
  );
});
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
