"use client";
import React, { type InputHTMLAttributes } from "react";

interface StripeInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "style"> {
  label?: string;
}

export const StripeInput: React.FC<StripeInputProps> = ({ label, id, ...props }) => {
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
            color: "rgb(255, 255, 255)",
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
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "6px",
          backgroundColor: "#30313d",
          color: "rgb(255, 255, 255)",
          outline: "none",
          boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.5), 0px 1px 6px rgba(0, 0, 0, 0.25)",
          transition: "background 0.15s ease, border 0.15s ease, box-shadow 0.15s ease, color 0.15s ease",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}
        onFocus={e => {
          e.target.style.borderColor = "#ff424c";
          e.target.style.boxShadow = "0px 2px 4px rgba(0, 0, 0, 0.5), 0px 1px 6px rgba(0, 0, 0, 0.25), 0 0 0 1px #ff424c";
        }}
        onBlur={e => {
          e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
          e.target.style.boxShadow = "0px 2px 4px rgba(0, 0, 0, 0.5), 0px 1px 6px rgba(0, 0, 0, 0.25)";
        }}
        {...props}
      />
    </div>
  );
};
