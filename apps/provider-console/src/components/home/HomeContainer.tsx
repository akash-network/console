"use client";
import React from "react";

import { Footer } from "@src/components/layout/Footer";
import Layout from "../layout/Layout";

export function HomeContainer() {
  return (
    <Layout containerClassName="flex h-full flex-col justify-between" isLoading={false}>
      <div>
        <div className="mb-4"></div>
      </div>
      <Footer />
    </Layout>
  );
}

