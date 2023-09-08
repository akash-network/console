import React, { useEffect, useState } from "react";
import { darken, lighten, PaletteMode } from "@mui/material";
import { createTheme, ThemeProvider, ThemeOptions } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { customColors } from "@src/utils/colors";
import { grey } from "@mui/material/colors";
import { useDarkMode } from "next-dark-mode";
import { accountBarHeight } from "@src/utils/constants";

type ContextType = {
  mode: string;
};

const CustomThemeProviderContext = React.createContext<ContextType>({ mode: null });

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
          },
          success: {
            main: darken(customColors.green, 0.2),
            light: darken(customColors.green, 0.1),
            dark: darken(customColors.green, 0.3)
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
          },
          success: {
            main: customColors.green,
            light: lighten(customColors.green, 0.2),
            dark: darken(customColors.green, 0.2)
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
          height: `calc(100% - ${accountBarHeight}px) !important`,
          width: "100%",
          overflowY: "scroll !important",
          padding: "0 !important",
          "&::-webkit-scrollbar": {
            width: "10px"
          },
          "&::-webkit-scrollbar-track": {
            background: mode === "dark" ? darken(customColors.dark, 0.2) : customColors.white
          },
          "&::-webkit-scrollbar-thumb": {
            width: "5px",
            backgroundColor: mode === "dark" ? lighten(customColors.darkLight, 0.2) : grey[500],
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
          top: "6px !important",
          right: "8px !important"
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
          color: customColors.main,
          "&:hover": {
            textDecoration: "underline"
          }
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
        outlinedPrimary: {
          color: mode === "dark" ? customColors.white : customColors.dark,
          borderColor: mode === "dark" ? darken(customColors.white, 0.5) : lighten(customColors.dark, 0.5)
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
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            backgroundColor: mode === "dark" ? grey[900] : grey[400]
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
  const { darkModeActive } = useDarkMode();
  const mode = darkModeActive ? "dark" : "light";
  // Update the theme only if the mode changes
  const theme = React.useMemo(() => (darkModeActive ? darkTheme : lightTheme), [darkModeActive]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <CustomThemeProviderContext.Provider value={{ mode }}>
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
