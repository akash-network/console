import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { FormItem } from "@src/components/ui/form";
import { Label } from "@src/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui/select";

type Props = {};

export const ColorModeSelect: React.FunctionComponent<Props> = () => {
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
