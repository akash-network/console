import { HomeContainer } from "@src/components/home/HomeContainer";
import React from "react";

export default function Home() {
  return <HomeContainer />;
}

export async function getServerSideProps() {
  return {
    props: {}
    //revalidate: 20
  };
}
