"use client";
import React from "react";
import { CreditCard } from "lucide-react";

/** Takes a Stripe card brand, or the payment method type for methods without a card such as Link. */
export const CardBrandMark: React.FunctionComponent<{ brand?: string | null }> = ({ brand }) => (
  <span className="inline-flex h-7 w-[42px] shrink-0 items-center justify-center rounded-md border bg-white" aria-hidden>
    <BrandArtwork brand={brand} />
  </span>
);

const BrandArtwork: React.FunctionComponent<{ brand?: string | null }> = ({ brand }) => {
  switch (brand) {
    case "mastercard":
      return (
        <svg width="26" height="18" viewBox="0 0 26 18" data-testid="mastercard-mark">
          <circle cx="10" cy="9" r="7" fill="#EB001B" />
          <circle cx="16" cy="9" r="7" fill="#F79E1B" />
          <path d="M13 3.6a7 7 0 000 10.8 7 7 0 000-10.8z" fill="#FF5F00" />
        </svg>
      );
    case "visa":
      return <span className="text-[13px] font-extrabold italic tracking-tight text-[#1A1F71]">VISA</span>;
    case "amex":
      return <span className="text-[10px] font-extrabold tracking-tight text-[#2E77BC]">AMEX</span>;
    case "link":
      return <span className="text-xs font-bold text-[#011E0F]">link</span>;
    default:
      return <CreditCard className="h-4 w-4 text-neutral-500" data-testid="generic-card-mark" />;
  }
};
