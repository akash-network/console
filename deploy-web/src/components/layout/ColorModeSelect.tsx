import React, { useEffect, useState } from "react";
import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent } from "@mui/material";
import { useDarkMode } from "next-dark-mode";

type Props = {};

export const ColorModeSelect: React.FunctionComponent<Props> = () => {
  const { darkModeActive, autoModeActive, switchToDarkMode, switchToLightMode, switchToAutoMode } = useDarkMode();
  const [mode, setMode] = useState("auto");

  useEffect(() => {
    const _mode = autoModeActive ? "auto" : darkModeActive ? "dark" : "light";
    setMode(_mode);
  }, []);

  const onModeChange = (event: SelectChangeEvent<string>) => {
    const newMode = event.target.value;
    setMode(newMode);

    switch (newMode) {
      case "dark":
        switchToDarkMode();
        break;
      case "light":
        switchToLightMode();
        break;

      case "auto":
      default:
        switchToAutoMode();
        break;
    }
  };

  return (
    <FormControl>
      <InputLabel id="theme-select">Theme</InputLabel>
      <Select labelId="theme-select" value={mode} label="Theme" onChange={onModeChange} size="small">
        <MenuItem value="auto">Auto</MenuItem>
        <MenuItem value="dark">Dark 🌑</MenuItem>
        <MenuItem value="light">Light ☀️</MenuItem>
      </Select>
    </FormControl>
  );
};
