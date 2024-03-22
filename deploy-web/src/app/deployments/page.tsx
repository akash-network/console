import React from "react";
import { Metadata } from "next";
import { DeploymentList } from "./DeploymentList";

export const metadata: Metadata = {
  title: "Deployments"
};

export default function Deployments() {
  return <DeploymentList />;
}
