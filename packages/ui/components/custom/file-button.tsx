"use client";
import React, { useRef, ChangeEvent } from "react";
import { Button, ButtonProps } from "../button";

interface FileButtonProps extends Omit<ButtonProps, "onChange"> {
  onFileSelect?: (file: File | null) => void;
  accept?: string;
  multiple?: boolean;
}

export function FileButton({ children, onFileSelect, accept, multiple = false, ...buttonProps }: FileButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    onFileSelect?.(file);

    // Reset the input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <Button type="button" onClick={handleClick} {...buttonProps}>
        {children}
      </Button>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept={accept} multiple={multiple} className="hidden" />
    </>
  );
}
