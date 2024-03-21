"use client";
import { useState } from "react";
import { FormItem } from "../ui/form";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Label } from "../ui/label";
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
    vertical: "bottom",
    horizontal: "center"
  },
  transformOrigin: {
    vertical: "top",
    horizontal: "center"
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

export const SelectCheckbox = ({ defaultValue, options, onSelectedChange, label, disabled, placeholder }: React.PropsWithChildren<Props>) => {
  const [selected, setSelected] = useState(defaultValue);
  const isAllSelected = options.length > 0 && selected.length === options.length;

  const handleChange = value => {
    // const value = event.target.value;
    let newValue = value;
    if (value[value.length - 1] === "all") {
      newValue = selected.length === options.length ? [] : options;
    }

    setSelected(newValue);
    onSelectedChange(newValue);
  };

  return (
    <FormItem>
      <Label>{label}</Label>

      {/* <InputLabel id="mutiple-select-label">{label}</InputLabel> */}
      {/* <Select
        labelId="mutiple-select-label"
        multiple
        label={label}
        value={selected}
        onChange={handleChange}
        renderValue={selected => selected.join(", ")}
        size="small"
        // TODO Fix
        MenuProps={MenuProps as any}
        disabled={disabled}
        variant="outlined"
        classes={{
          select: classes.menuRoot
        }}
      >
        <MenuItem
          value="all"
          classes={{
            root: isAllSelected ? classes.selectedAll : ""
          }}
        >
          <ListItemIcon>
            <Checkbox
              classes={{ root: classes.checkboxRoot, indeterminate: classes.indeterminateColor }}
              checked={isAllSelected}
              indeterminate={selected.length > 0 && selected.length < options.length}
              size="small"
              color="secondary"
            />
          </ListItemIcon>
          <ListItemText classes={{ primary: classes.selectAllText }} primary="Select All" />
        </MenuItem>
        {options.map(option => (
          <MenuItem key={option} value={option}>
            <ListItemIcon>
              <Checkbox checked={selected.indexOf(option) > -1} size="small" classes={{ root: classes.checkboxRoot }} color="secondary" />
            </ListItemIcon>
            <ListItemText primary={option} />
          </MenuItem>
        ))}
      </Select> */}

      <Select value={selected.join(", ")} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem
              value="all"
              // classes={{
              //   root: isAllSelected ? classes.selectedAll : ""
              // }}
            >
              <Checkbox
                // classes={{ root: classes.checkboxRoot, indeterminate: classes.indeterminateColor }}
                checked={isAllSelected}
                // indeterminate={selected.length > 0 && selected.length < options.length}
              />
              <div
              // classes={{ primary: classes.selectAllText }}
              >
                Select All
              </div>
            </SelectItem>
            {options.map(option => (
              <SelectItem key={option} value={option}>
                <Checkbox
                  checked={selected.indexOf(option) > -1}
                  // classes={{ root: classes.checkboxRoot }}
                />
                <div>{option}</div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormItem>
  );
};
