"use client";
import type React from "react";
import { FormattedNumber } from "react-intl";

/** Single source of the USD display format shared by the billing components, so the copies can't drift apart. */
export const UsdValue: React.FunctionComponent<{ value: number }> = ({ value }) => <FormattedNumber value={value} style="currency" currency="USD" />;
