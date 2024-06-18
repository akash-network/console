import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { FormItem, Label, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";

export const ColorModeSelect: React.FunctionComponent = () => {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const onThemeClick = (theme: string) => {
    setTheme(theme);
    document.cookie = `theme=${theme}; path=/`;
  };

  return (
    <FormItem>
      <Label>Theme</Label>
      <Select value={theme} onValueChange={onThemeClick}>
        <SelectTrigger>
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="dark">Dark 🌑</SelectItem>
            <SelectItem value="light">Light ☀️</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormItem>
  );
};
