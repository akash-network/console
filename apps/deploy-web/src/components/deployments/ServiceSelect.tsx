"use client";

import { useState } from "react";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";

type Props = {
  defaultValue: string;
  services: string[];
  onSelectedChange: (value: string) => void;
};

export const ServiceSelect = ({ defaultValue, services, onSelectedChange }: Props) => {
  const [selected, setSelected] = useState(defaultValue);

  const handleChange = (event: SelectChangeEvent) => {
    const value = event.target.value;

    setSelected(value);
    onSelectedChange(value);
  };

  return (
    <FormControl className="w-auto min-w-[150px]">
      <InputLabel id="service-select-label">Services</InputLabel>
      <Select
        labelId="service-select-label"
        value={selected}
        onChange={handleChange}
        variant="outlined"
        size="small"
        label="Services"
        classes={{
          select: "py-2 px-4 text-xs"
        }}
      >
        {services.map(service => (
          <MenuItem key={service} value={service} dense>
            <span className="text-sm text-muted-foreground">{service}</span>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
