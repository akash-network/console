"use client";
import { useState } from "react";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

import { Checkbox } from "../ui/checkbox";

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250
    }
  },
  getContentAnchorEl: null,
  anchorOrigin: {
    vertical: "bottom" as const,
    horizontal: "center" as const
  },
  transformOrigin: {
    vertical: "top" as const,
    horizontal: "center" as const
  }
  // variant: "menu"
};

// const useStyles = makeStyles()(theme => ({
//   formControl: {
//     minWidth: "150px",
//     width: "auto"
//   },
//   indeterminateColor: {
//     color: "#f50057"
//   },
//   selectAllText: {
//     fontWeight: 500
//   },
//   selectedAll: {
//     backgroundColor: "rgba(0, 0, 0, 0.08)",
//     "&:hover": {
//       backgroundColor: "rgba(0, 0, 0, 0.08)"
//     }
//   },
//   menuRoot: {
//     padding: ".25rem .5rem",
//     fontSize: ".75rem !important"
//   },
//   checkboxRoot: {
//     padding: "4px"
//   }
// }));

interface Props {
  defaultValue: string[];
  options: string[];
  onSelectedChange: (value: string[]) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

export const SelectCheckbox = ({ defaultValue, options, onSelectedChange, label, disabled }: React.PropsWithChildren<Props>) => {
  const [selected, setSelected] = useState(defaultValue);
  const isAllSelected = options.length > 0 && selected.length === options.length;

  const handleChange = event => {
    const value = event.target.value;
    let newValue = value;
    if (value[value.length - 1] === "all") {
      newValue = selected.length === options.length ? [] : options;
    }

    setSelected(newValue);
    onSelectedChange(newValue);
  };

  return (
    <FormControl className="w-auto min-w-[150px]">
      <InputLabel id="mutiple-select-label">{label}</InputLabel>
      <Select
        labelId="mutiple-select-label"
        multiple
        label={label}
        value={selected}
        onChange={handleChange}
        renderValue={selected => selected.join(", ")}
        size="small"
        MenuProps={MenuProps}
        disabled={disabled}
        variant="outlined"
        classes={{
          select: "py-2 px-4 text-xs"
        }}
      >
        <MenuItem
          value="all"
          classes={{
            root: isAllSelected ? "bg-secondary" : ""
          }}
        >
          <ListItemIcon>
            <Checkbox checked={isAllSelected} />
          </ListItemIcon>
          <ListItemText classes={{ primary: "font-normal" }} primary="Select All" />
        </MenuItem>
        {options.map(option => (
          <MenuItem key={option} value={option}>
            <ListItemIcon>
              <Checkbox checked={selected.indexOf(option) > -1} />
            </ListItemIcon>
            <ListItemText primary={option} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
