"use client";
import { useState } from "react";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import type { SelectChangeEvent } from "@mui/material/Select";
import Select from "@mui/material/Select";

import type { LeaseDto } from "@src/types/deployment";

type Props = {
  defaultValue: string;
  leases: Pick<LeaseDto, "id" | "gseq">[];
  onSelectedChange: (value: string) => void;
};

export const LeaseSelect = ({ defaultValue, leases, onSelectedChange }: Props) => {
  const [selected, setSelected] = useState(defaultValue);

  const handleChange = (event: SelectChangeEvent) => {
    const value = event.target.value;

    setSelected(value);
    onSelectedChange(value);
  };

  return (
    <FormControl className="w-auto min-w-[150px]">
      <InputLabel id="lease-select-label">Lease</InputLabel>
      <Select
        labelId="lease-select-label"
        label="Lease"
        value={selected}
        onChange={handleChange}
        variant="outlined"
        classes={{
          select: "py-2 px-4 text-xs"
        }}
      >
        {leases.map(l => (
          <MenuItem key={l.id} value={l.id} dense>
            <p className="leading-4">GSEQ: {l.gseq}</p>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
