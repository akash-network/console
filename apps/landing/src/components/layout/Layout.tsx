import React, { ReactNode, useEffect, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { IntlProvider } from "react-intl";
import Wave from "react-wavify";
import { Fade, LinearProgress, useMediaQuery, useTheme } from "@mui/material";
import Box from "@mui/material/Box";
import { makeStyles } from "tss-react/mui";

import { useDocHeight } from "@src/hooks/useDocHeight";
import { headerHeight, mobileHeaderHeight } from "@src/utils/constants";
import { ErrorFallback } from "../shared/ErrorFallback";
import { Footer } from "./Footer";
import { Header } from "./Header";
import PageHead from "./PageHead";

type Props = {
  isLoading?: boolean;
  children?: ReactNode;
};

const Layout: React.FunctionComponent<Props> = ({ children }) => {
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    if (navigator?.language) {
      setLocale(navigator?.language);
    }
  }, []);

  return (
    <IntlProvider locale={locale}>
      <LayoutApp>{children}</LayoutApp>
    </IntlProvider>
  );
};

const useStyles = makeStyles()(theme => ({
  wave: {
    height: "100%",
    zIndex: -1,
    position: "absolute"
  }
}));

const LayoutApp: React.FunctionComponent<Props> = ({ children, isLoading }) => {
  const theme = useTheme();
  const { classes } = useStyles();
  const height = useDocHeight();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        color: "text.primary",
        position: "relative"
      }}
    >
      <PageHead />

      <Box
        sx={{
          marginLeft: { xs: 0, sm: 0 },
          height: "100%",
          marginTop: { xs: `${mobileHeaderHeight}px`, md: "80px" },
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          justifyContent: "space-between"
        }}
      >
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <Box sx={{ width: "100%", zIndex: 100 }}>
            {isLoading !== undefined && (
              <Fade
                in={isLoading}
                style={{
                  transitionDelay: isLoading ? "300ms" : "0ms"
                }}
              >
                <LinearProgress color="secondary" />
              </Fade>
            )}

            <Header />

            {children}
          </Box>

          <Footer />
        </ErrorBoundary>

        {typeof window !== "undefined" && (
          <Box sx={{ position: "absolute", width: "100%", height: height - (isMobile ? 0 : headerHeight) }}>
            <Wave
              fill={theme.palette.secondary.main}
              paused={false}
              opacity={0.1}
              className={classes.wave}
              options={{
                height: window.innerHeight * 0.6,
                amplitude: isMobile ? 12 : 25,
                speed: 0.1,
                points: isMobile ? 5 : 10
              }}
            />

            <Wave
              fill={theme.palette.secondary.main}
              paused={false}
              opacity={0.1}
              className={classes.wave}
              options={{
                height: window.innerHeight * 0.5,
                amplitude: isMobile ? 15 : 30,
                speed: 0.15,
                points: isMobile ? 5 : 11
              }}
            />

            <Wave
              fill={theme.palette.secondary.main}
              paused={false}
              opacity={0.1}
              className={classes.wave}
              options={{
                height: window.innerHeight * 0.45,
                amplitude: isMobile ? 20 : 40,
                speed: 0.2,
                points: isMobile ? 6 : 12
              }}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default Layout;
