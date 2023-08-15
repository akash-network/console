import { SelectedRange } from "@src/utils/constants";
import { ReactNode } from "react";
import { makeStyles } from "tss-react/mui";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";

type Props = {
  children?: ReactNode;
  selectedRange: SelectedRange;
  onRangeChange: (selectedRange: SelectedRange) => void;
};

const useStyles = makeStyles()(theme => ({
  graphRangeSelect: {
    [theme.breakpoints.down("sm")]: {
      margin: "0 auto"
    }
  }
}));

export const TimeRange: React.FunctionComponent<Props> = ({ selectedRange, onRangeChange }) => {
  const { classes } = useStyles();

  const _onRangeChange = (selectedRange: SelectedRange) => {
    onRangeChange(selectedRange);
  };

  return (
    <ButtonGroup size="small" aria-label="Graph range select" color="secondary" className={classes.graphRangeSelect}>
      <Button variant={selectedRange === SelectedRange["7D"] ? "contained" : "outlined"} onClick={() => _onRangeChange(SelectedRange["7D"])} color="secondary">
        7D
      </Button>
      <Button variant={selectedRange === SelectedRange["1M"] ? "contained" : "outlined"} onClick={() => _onRangeChange(SelectedRange["1M"])} color="secondary">
        1M
      </Button>
      <Button
        variant={selectedRange === SelectedRange["ALL"] ? "contained" : "outlined"}
        onClick={() => _onRangeChange(SelectedRange["ALL"])}
        color="secondary"
      >
        ALL
      </Button>
    </ButtonGroup>
  );
};
