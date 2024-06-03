import React, { useEffect, useState } from "react";
import { darken, PaletteMode } from "@mui/material";
import { grey } from "@mui/material/colors";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeOptions,ThemeProvider } from "@mui/material/styles";
import { useDarkMode } from "next-dark-mode";

import { customColors } from "@src/utils/colors";

type ContextType = {
  mode: string;
  toggleMode: () => void;
};

const CustomThemeProviderContext = React.createContext<ContextType>({ mode: "", toggleMode: null });

const getDesignTokens = (mode: PaletteMode): ThemeOptions => ({
  palette: {
    mode,
    ...(mode === "light"
      ? {
          // LIGHT
          primary: {
            main: customColors.dark
          },
          secondary: {
            main: customColors.main
          },
          background: {
            default: customColors.lightBg
          }
        }
      : {
          // DARK
          primary: {
            main: customColors.dark
          },
          secondary: {
            main: customColors.main
          },
          background: {
            default: customColors.dark,
            paper: customColors.darkLight
          },
          text: {
            primary: grey[200]
          }
        })
  },
  typography: {
    fontFamily: ["Inter", "sans-serif"].join(",")
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536
    }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          WebkitFontSmoothing: "auto",
          height: "100%",
          width: "100%"
        },
        body: {
          height: "calc(100% - 80px)",
          width: "100%",
          overflowY: "auto !important",
          padding: "0 !important",
          "&::-webkit-scrollbar": {
            width: "10px"
          },
          "&::-webkit-scrollbar-track": {
            background: mode === "dark" ? darken(customColors.dark, 0.2) : customColors.white
          },
          "&::-webkit-scrollbar-thumb": {
            width: "5px",
            backgroundColor: mode === "dark" ? darken(customColors.darkLight, 0.5) : grey[500],
            borderRadius: "5px"
          }
        },
        "*": {
          transition: "background-color .2s ease"
        },
        ul: {
          paddingLeft: "2rem"
        },
        // Nextjs root div
        "#__next": {
          height: "100%"
        },
        // Page loading styling
        "#nprogress .bar": {
          background: `${customColors.main} !important`,
          zIndex: "10000 !important"
        },
        "#nprogress .spinner": {
          zIndex: `10000 !important`,
          top: "18px !important",
          right: "10px !important"
        },
        "#nprogress .peg": {
          boxShadow: `0 0 10px ${customColors.main}, 0 0 5px ${customColors.main}`
        },
        "#nprogress .spinner-icon": {
          borderTopColor: `${customColors.main} !important`,
          borderLeftColor: `${customColors.main} !important`
        },
        a: {
          textDecoration: "none",
          color: customColors.link
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          transition: "background-color .2s ease, box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
          boxShadow: "none"
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        text: {
          color: mode === "dark" ? customColors.white : customColors.dark
        },
        outlinedSecondary: {
          color: mode === "dark" ? customColors.white : customColors.dark,
          borderWidth: "2px",
          "&:hover": {
            borderWidth: "2px"
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-notchedOutline": {
            // border: `5px solid green`
          },
          "&.Mui-focused": {
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: mode === "dark" ? grey[300] : grey[600]
            }
          }
        }
      }
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          "& .MuiInputLabel-root.Mui-focused": {
            color: mode === "dark" ? grey[300] : grey[600]
          }
        }
      }
    }
  }
});

const darkTheme = createTheme(getDesignTokens("dark"));
const lightTheme = createTheme(getDesignTokens("light"));

export const CustomThemeProvider = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false);
  const { darkModeActive, switchToDarkMode, switchToLightMode } = useDarkMode();
  const mode = darkModeActive ? "dark" : "light";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const toggleMode = () => {
    if (darkModeActive) {
      switchToLightMode();
    } else {
      switchToDarkMode();
    }
  };

  // Update the theme only if the mode changes
  const theme = React.useMemo(() => (darkModeActive ? darkTheme : lightTheme), [darkModeActive]);

  return (
    <CustomThemeProviderContext.Provider value={{ mode, toggleMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {isMounted ? children : <div style={{ visibility: "hidden" }}>{children}</div>}
      </ThemeProvider>
    </CustomThemeProviderContext.Provider>
  );
};

export const useColorMode = () => {
  return { ...React.useContext(CustomThemeProviderContext) };
};
