"use strict";
"use client";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useColorMode = exports.CustomThemeProvider = void 0;
var react_1 = require("react");
var material_1 = require("@mui/material");
var colors_1 = require("@mui/material/colors");
var styles_1 = require("@mui/material/styles");
var next_themes_1 = require("next-themes");
var colors_2 = require("@src/utils/colors");
var CustomThemeProviderContext = react_1.default.createContext({});
var getDesignTokens = function (mode) { return ({
    palette: __assign({ mode: mode }, (mode === "light"
        ? {
            // LIGHT
            primary: {
                main: "hsl(var(--primary))"
            },
            secondary: {
                main: colors_2.customColors.main
            },
            background: {
                default: colors_2.customColors.lightBg
            },
            success: {
                main: (0, material_1.darken)(colors_2.customColors.green, 0.2),
                light: (0, material_1.darken)(colors_2.customColors.green, 0.1),
                dark: (0, material_1.darken)(colors_2.customColors.green, 0.3)
            }
        }
        : {
            // DARK
            primary: {
                main: "hsl(var(--primary))"
            },
            secondary: {
                main: colors_2.customColors.main
            },
            background: {
                default: colors_2.customColors.dark,
                paper: colors_2.customColors.darkLight
            },
            success: {
                main: colors_2.customColors.green,
                light: (0, material_1.lighten)(colors_2.customColors.green, 0.2),
                dark: (0, material_1.darken)(colors_2.customColors.green, 0.2)
            }
        })),
    typography: {
        fontFamily: ["Geist", "sans-serif"].join(",")
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
        MuiLinearProgress: {
            styleOverrides: {
                root: {
                    backgroundColor: "hsl(var(--primary) / 15%)"
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
                    color: mode === "dark" ? colors_2.customColors.white : colors_2.customColors.dark
                },
                outlinedPrimary: {
                    color: mode === "dark" ? colors_2.customColors.white : colors_2.customColors.dark,
                    borderColor: mode === "dark" ? (0, material_1.darken)(colors_2.customColors.white, 0.5) : (0, material_1.lighten)(colors_2.customColors.dark, 0.5)
                },
                outlinedSecondary: {
                    color: mode === "dark" ? colors_2.customColors.white : colors_2.customColors.dark,
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
                            borderColor: mode === "dark" ? colors_1.grey[300] : colors_1.grey[600]
                        }
                    }
                }
            }
        },
        MuiFormControl: {
            styleOverrides: {
                root: {
                    "& .MuiInputLabel-root.Mui-focused": {
                        color: mode === "dark" ? colors_1.grey[300] : colors_1.grey[600]
                    }
                }
            }
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    "&.Mui-selected": {
                        backgroundColor: mode === "dark" ? colors_1.grey[900] : colors_1.grey[400]
                    }
                }
            }
        }
    }
}); };
var darkTheme = (0, styles_1.createTheme)(getDesignTokens("dark"));
var lightTheme = (0, styles_1.createTheme)(getDesignTokens("light"));
var CustomThemeProvider = function (_a) {
    var children = _a.children;
    var _b = (0, react_1.useState)(false), isMounted = _b[0], setIsMounted = _b[1];
    var nextTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var darkModeActive = nextTheme === "dark";
    var mode = darkModeActive ? "dark" : "light";
    // Update the theme only if the mode changes
    var theme = react_1.default.useMemo(function () { return (darkModeActive ? darkTheme : lightTheme); }, [darkModeActive]);
    (0, react_1.useEffect)(function () {
        setIsMounted(true);
    }, []);
    return (<CustomThemeProviderContext.Provider value={{ mode: mode }}>
      <styles_1.ThemeProvider theme={theme}>{<div style={isMounted ? {} : { visibility: "hidden" }}>{children}</div>}</styles_1.ThemeProvider>
    </CustomThemeProviderContext.Provider>);
};
exports.CustomThemeProvider = CustomThemeProvider;
var useColorMode = function () {
    return __assign({}, react_1.default.useContext(CustomThemeProviderContext));
};
exports.useColorMode = useColorMode;
