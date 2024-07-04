import { ReactNode } from "react";
import React from "react";
import Head from "next/head";
import { Box, Button, Typography, useTheme } from "@mui/material";
import Image from "next/legacy/image";
import dynamic from "next/dynamic";
import LaunchIcon from "@mui/icons-material/Launch";
import Link from "next/link";

const Waves = dynamic(import("../components/waves"), { ssr: false });

type Props = {
  children?: ReactNode;
};

const IndexPage: React.FunctionComponent<Props> = ({}) => {
  const theme = useTheme();

  return (
    <>
      <Head>
        <title>Cloudmos Import</title>
      </Head>

      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          p: 4,
          textAlign: "center"
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", flexDirection: { xs: "column", sm: "row" } }}>
          <div>
            <Image
              alt="Cloudmos Logo"
              src={theme.palette.mode === "dark" ? "/images/cloudmos-logo.png" : "/images/cloudmos-logo-light.png"}
              layout="fixed"
              quality={100}
              width={200}
              height={50}
              loading="eager"
              priority
            />
          </div>
        </Box>

        <Typography sx={{ mt: 2 }} variant="h5">
          Cloudmos is now fully moved to <a href="https://console.akash.network">console.akash.network</a>.
        </Typography>

        <Button
          href="https://console.akash.network"
          component={Link}
          variant="contained"
          color="secondary"
          size="large"
          sx={{ mt: 2, display: "inline-flex", alignItems: "center", textTransform: "initial" }}
        >
          Go to Akash Console
          <LaunchIcon fontSize="small" sx={{ ml: 1 }} />
        </Button>

        <Typography sx={{ mt: 2 }}>See you on the other side! 🚀</Typography>

        <Waves />
      </Box>
    </>
  );
};

export async function getServerSideProps() {
  return {
    props: {}
    //revalidate: 20
  };
}

export default IndexPage;
