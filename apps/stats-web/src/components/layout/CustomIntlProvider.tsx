"use client";
import { ReactNode, useEffect, useState } from "react";
import { IntlProvider } from "react-intl";

type Props = {
  children?: ReactNode;
};

export const CustomIntlProvider: React.FunctionComponent<Props> = ({ children }) => {
  const [locale, setLocale] = useState("en-US");

  useEffect(() => {
    if (navigator?.language) {
      setLocale(navigator?.language);
    }
  }, []);

  return (
    <IntlProvider locale={locale} defaultLocale="en-US">
      {children}
    </IntlProvider>
  );
};
