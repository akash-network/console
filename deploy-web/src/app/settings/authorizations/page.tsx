import React from "react";
import { Metadata } from "next";
import { Authorizations } from "./Authorizations";

export const metadata: Metadata = {
  title: "Authorizations"
};

export default function AuthorizationsPage() {
  return <Authorizations />;
}
