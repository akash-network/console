"use client";
import { FormItem } from "@src/components/ui/form";
import { Label } from "@src/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui/select";
import { useState } from "react";

// const useStyles = makeStyles()(theme => ({
//   formControl: {
//     minWidth: "150px",
//     width: "auto"
//   },
//   menuRoot: {
//     paddingTop: "17px",
//     paddingBottom: "2px"
//   },
//   selectLabel: {
//     top: "2px",
//     left: "4px"
//   },
//   selectItem: {
//     lineHeight: "1rem"
//   }
// }));

export const LeaseSelect = ({ defaultValue, leases, onSelectedChange }) => {
  const [selected, setSelected] = useState(defaultValue);

  const handleChange = event => {
    const value = event.target.value;

    setSelected(value);
    onSelectedChange(value);
  };

  return (
    <FormItem>
      <Label id="lease-select-label">Lease</Label>
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
          <SelectValue placeholder="Select lease" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {leases.map(l => (
              <SelectItem key={l.id} value={l.id}>
                GSEQ: {l.gseq}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormItem>
  );
};
