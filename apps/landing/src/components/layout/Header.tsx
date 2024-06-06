import React from "react";
import LaunchIcon from "@mui/icons-material/RocketLaunch";
import { AppBar, Box, Button, Container, Toolbar, useTheme } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import { makeStyles } from "tss-react/mui";

import { customColors } from "@src/utils/colors";
import { headerHeight, mobileHeaderHeight } from "@src/utils/constants";

const useStyles = makeStyles()(theme => ({
  toolbar: {
    minHeight: headerHeight,
    alignItems: "center",
    backgroundColor: theme.palette.mode === "dark" ? customColors.dark : customColors.lightBg,
    [theme.breakpoints.down("sm")]: {
      minHeight: mobileHeaderHeight
    }
  }
}));

export const Header: React.FunctionComponent = () => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <AppBar position="fixed" sx={{ boxShadow: "none" }}>
      <Toolbar className={classes.toolbar}>
        <Container sx={{ padding: { xs: 0, sm: "inherit" } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ height: "40px", width: "160px" }}>
              <Link href="/">
                <Image
                  alt="Cloudmos Logo"
                  src={theme.palette.mode === "dark" ? "/images/cloudmos-logo.png" : "/images/cloudmos-logo-light.png"}
                  layout="responsive"
                  quality={100}
                  width={160}
                  height={40}
                  priority
                />
              </Link>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Button color="secondary" variant="contained" endIcon={<LaunchIcon />} component="a" href={"https://deploy.cloudmos.io"} target="_blank">
                Deploy
              </Button>
            </Box>
          </Box>
        </Container>
      </Toolbar>
    </AppBar>
  );
};
