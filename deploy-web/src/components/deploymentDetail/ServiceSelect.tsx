import { FormControl, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  formControl: {
    minWidth: "150px",
    width: "auto"
  },
  select: {
    padding: ".25rem .5rem",
    display: "flex !important",
    alignItems: "center"
  }
}));

export const ServiceSelect = ({ defaultValue, services, onSelectedChange }) => {
  const { classes } = useStyles();
  const [selected, setSelected] = useState(defaultValue);

  const handleChange = event => {
    const value = event.target.value;

    setSelected(value);
    onSelectedChange(value);
  };

  return (
    <FormControl className={classes.formControl}>
      <InputLabel id="service-select-label">Services</InputLabel>
      <Select
        labelId="service-select-label"
        value={selected}
        onChange={handleChange}
        variant="outlined"
        size="small"
        label="Services"
        classes={{
          select: classes.select
        }}
      >
        {services.map(service => (
          <MenuItem key={service} value={service} dense>
            <Typography variant="caption">{service}</Typography>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
