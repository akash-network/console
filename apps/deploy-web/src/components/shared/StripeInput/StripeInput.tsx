"use client";
import React, { type InputHTMLAttributes, useCallback } from "react";
import { useTheme } from "next-themes";

interface StripeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "style"> {
  label?: string;
}

export const StripeInput: React.FC<StripeInputProps> = ({ label, id, ...props }) => {
  const { resolvedTheme } = useTheme();

  const themed = useCallback(
    (light: string, dark: string) => {
      return resolvedTheme === "light" ? light : dark;
    },
    [resolvedTheme]
  );

  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          style={{
            display: "block",
            marginBottom: "6px",
            fontSize: "14px",
            fontWeight: "400",
            color: themed("rgb(48, 49, 61)", "rgb(255, 255, 255)"),
            lineHeight: "20px"
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: "16px",
          lineHeight: "24px",
          border: themed("1px solid rgb(230, 230, 230)", "1px solid rgba(255, 255, 255, 0.1)"),
          borderRadius: "6px",
          backgroundColor: themed("#fff", "#30313d"),
          color: themed("rgb(48, 49, 61)", "rgb(255, 255, 255)"),
          outline: "none",
          boxShadow: themed("rgba(0, 0, 0, 0.03) 0px 1px 1px 0px", "0px 2px 4px rgba(0, 0, 0, 0.5), 0px 1px 6px rgba(0, 0, 0, 0.25)"),
          transition: "background 0.15s ease, border 0.15s ease, box-shadow 0.15s ease, color 0.15s ease",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
        onFocus={e => {
          e.target.style.borderColor = themed("#ff424c", "#ff424c");
          e.target.style.boxShadow = themed(
            "0px 1px 1px rgba(0, 0, 0, 0.03), 0px 3px 6px rgba(0, 0, 0, 0.02), 0 0 0 3px hsla(357, 100%, 63%, 25%), 0 1px 1px 0 rgba(0, 0, 0, 0.08)",
            "0px 2px 4px rgba(0, 0, 0, 0.5), 0px 1px 6px rgba(0, 0, 0, 0.25), 0 0 0 3px hsla(357, 100%, 63%, 25%), 0 1px 1px 0 rgba(255, 255, 255, 0.12)"
          );
        }}
        onBlur={e => {
          e.target.style.borderColor = themed("rgb(230, 230, 230)", "rgba(255, 255, 255, 0.1)");
          e.target.style.boxShadow = themed("rgba(0, 0, 0, 0.03) 0px 1px 1px 0px", "0px 2px 4px rgba(0, 0, 0, 0.5), 0px 1px 6px rgba(0, 0, 0, 0.25)");
        }}
        {...props}
      />
    </div>
  );
};
