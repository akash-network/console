"use client";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { IntlProvider } from "react-intl";

import { getBrowserLocale } from "@src/lib/browser-locale/browser-locale";

type Props = {
  children?: ReactNode;
};

export const CustomIntlProvider: React.FunctionComponent<Props> = ({ children }) => {
  const [locale, setLocale] = useState("en-US");

  useEffect(function adoptBrowserLocale() {
    setLocale(getBrowserLocale());
  }, []);

  return (
    <IntlProvider locale={locale} defaultLocale="en-US">
      {children}
    </IntlProvider>
  );
};
