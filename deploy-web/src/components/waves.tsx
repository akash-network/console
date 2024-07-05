import { Box, useMediaQuery, useTheme } from "@mui/material";
import { useDocHeight } from "@src/hooks/useDocHeight";
import Wave from "react-wavify";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()(theme => ({
  wave: {
    height: "100%",
    zIndex: -1,
    position: "absolute",
    left: 0
  }
}));

export const Waves = () => {
  const theme = useTheme();

  const { classes } = useStyles();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const height = useDocHeight();
  return (
    <Box sx={{ position: "absolute", width: "100%", height: height, left: 0, zIndex: -1 }}>
      <Wave
        fill={theme.palette.secondary.main}
        paused={false}
        opacity={0.1}
        className={classes.wave}
        options={{
          height: window.innerHeight * 0.75,
          amplitude: isMobile ? 12 : 25,
          speed: 0.1,
          points: isMobile ? 5 : 10
        }}
      />

      <Wave
        fill={theme.palette.secondary.main}
        paused={false}
        opacity={0.1}
        className={classes.wave}
        options={{
          height: window.innerHeight * 0.65,
          amplitude: isMobile ? 15 : 30,
          speed: 0.15,
          points: isMobile ? 5 : 11
        }}
      />

      <Wave
        fill={theme.palette.secondary.main}
        paused={false}
        opacity={0.1}
        className={classes.wave}
        options={{
          height: window.innerHeight * 0.6,
          amplitude: isMobile ? 20 : 40,
          speed: 0.2,
          points: isMobile ? 6 : 12
        }}
      />
    </Box>
  );
};

export default Waves;
