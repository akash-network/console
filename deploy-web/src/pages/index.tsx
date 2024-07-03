import { ReactNode } from "react";
import React from "react";
import Head from "next/head";
import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/legacy/image";

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
              width={140}
              height={35}
              loading="eager"
              priority
            />
          </div>
          <Typography sx={{ ml: 1, fontSize: "1.1rem" }}>has reached end of life...</Typography>
        </Box>

        <Typography sx={{ mt: 2 }} variant="h5">
          Cloudmos is now fully moved to <a href="https://console.akash.network">console.akash.network</a>.
        </Typography>

        <Typography sx={{ mt: 2 }}>See you on the other side!</Typography>
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
