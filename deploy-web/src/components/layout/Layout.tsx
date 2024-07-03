import React, { ReactNode, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { IntlProvider } from "react-intl";

type Props = {
  isLoading?: boolean;
  isUsingSettings?: boolean;
  isUsingWallet?: boolean;
  children?: ReactNode;
};

const Layout: React.FunctionComponent<Props> = ({ children, isLoading, isUsingSettings, isUsingWallet }) => {
  const [locale, setLocale] = useState("en-US");

  useEffect(() => {
    if (navigator?.language) {
      setLocale(navigator?.language);
    }
  }, []);

  return (
    <IntlProvider locale={locale} defaultLocale="en-US">
      <LayoutApp isLoading={isLoading} isUsingSettings={isUsingSettings} isUsingWallet={isUsingWallet}>
        {children}
      </LayoutApp>
    </IntlProvider>
  );
};

const LayoutApp: React.FunctionComponent<Props> = ({ children, isLoading, isUsingSettings, isUsingWallet }) => {
  return <Box sx={{ height: "100%" }}>{children}</Box>;
};

export default Layout;
