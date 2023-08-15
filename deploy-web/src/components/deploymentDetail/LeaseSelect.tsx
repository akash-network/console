import { FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  formControl: {
    minWidth: "150px",
    width: "auto"
  },
  menuRoot: {
    paddingTop: "17px",
    paddingBottom: "2px"
  },
  selectLabel: {
    top: "2px",
    left: "4px"
  },
  selectItem: {
    lineHeight: "1rem"
  }
}));

export const LeaseSelect = ({ defaultValue, leases, onSelectedChange }) => {
  const { classes } = useStyles();
  const [selected, setSelected] = useState(defaultValue);

  const handleChange = event => {
    const value = event.target.value;

    setSelected(value);
    onSelectedChange(value);
  };

  return (
    <FormControl className={classes.formControl}>
      <InputLabel id="lease-select-label" className={classes.selectLabel}>
        Lease
      </InputLabel>
      <Select
        labelId="lease-select-label"
        value={selected}
        onChange={handleChange}
        variant="outlined"
        classes={{
          select: classes.menuRoot
        }}
      >
        {leases.map(l => (
          <MenuItem key={l.id} value={l.id} dense>
            <Typography variant="caption" className={classes.selectItem}>
              GSEQ: {l.gseq}
            </Typography>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
