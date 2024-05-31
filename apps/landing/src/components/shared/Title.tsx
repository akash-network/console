import { makeStyles } from "tss-react/mui";
import Typography from "@mui/material/Typography";
import { GradientText } from "./GradientText";
import { SxProps, Theme, useMediaQuery, useTheme } from "@mui/material";
import { cx } from "@emotion/css";
import { ReactNode } from "react";

type Props = {
  value: string | ReactNode;
  hasMargin?: boolean;
  subTitle?: boolean;
  sx?: SxProps<Theme>;
};

const useStyles = makeStyles()(theme => ({
  title: {
    fontSize: "2rem",
    fontWeight: "bold"
  },
  titleSmall: {
    fontSize: "1.5rem"
  },
  subTitle: {
    fontWeight: "300",
    fontSize: "1.5rem",
    color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[900]
  },
  subTitleSmall: {
    fontSize: "1.3rem"
  }
}));

export const Title: React.FunctionComponent<Props> = ({ value, subTitle, sx = {} }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.down("sm"));

  return subTitle ? (
    <Typography variant="h3" className={cx(classes.subTitle, { [classes.subTitleSmall]: matches })} sx={sx}>
      {value}
    </Typography>
  ) : (
    <Typography
      variant="h1"
      className={cx(classes.title, { [classes.titleSmall]: matches })}
      sx={{
        marginBottom: "1rem",
        ...sx
      }}
    >
      <GradientText>{value}</GradientText>
    </Typography>
  );
};
