"use client";
import { Checkbox } from "@src/components/ui/checkbox";
import { FormItem } from "@src/components/ui/form";
import { Label } from "@src/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui/select";
import { useState } from "react";

// const useStyles = makeStyles()(theme => ({
//   formControl: {
//     minWidth: "150px",
//     width: "auto"
//   },
//   select: {
//     padding: ".25rem .5rem",
//     display: "flex !important",
//     alignItems: "center"
//   }
// }));

export const ServiceSelect = ({ defaultValue, services, onSelectedChange }) => {
  const [selected, setSelected] = useState(defaultValue);

  const handleChange = value => {
    // const value = event.target.value;

    setSelected(value);
    onSelectedChange(value);
  };

  return (
    <FormItem>
      <Label id="service-select-label">Services</Label>
      <Select
        // labelId="service-select-label"
        value={selected}
        onValueChange={handleChange}
        // variant="outlined"
        // size="small"
        // label="Services"
        // classes={{
        //   select: classes.select
        // }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select protocol" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {services.map(service => (
              <SelectItem key={service} value={service}>
                <p className="text-sm text-muted-foreground">{service}</p>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormItem>
  );
};
