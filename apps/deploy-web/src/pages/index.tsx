import React from "react";

import { HomeContainer } from "@src/components/home/HomeContainer";

export default function Home() {
  return <HomeContainer />;
}

export async function getServerSideProps() {
  return {
    props: {}
    //revalidate: 20
  };
}
