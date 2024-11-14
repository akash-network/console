"use client";
import React from "react";
import { Button, Card } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

export function NotAProvider() {
  const router = useRouter();

  return (
    <div>
      <Card className="mt-4 p-10">
        <h2 className="text-lg font-bold">Become a Provider</h2>
        <p>Join the Akash Network and offer your compute resources.</p>
        <ul className="list-disc pl-5">
          <li>Earn by leasing your compute power.</li>
          <li>Utilize a streamlined UI with the Provider Console App.</li>
          <li>Access detailed provider documentation.</li>
          <li>Monitor provider status and earnings.</li>
          <li>Participate in a decentralized cloud marketplace.</li>
          <li>Contribute to a sustainable and open-source ecosystem.</li>
          <li>Gain exposure to a global network of developers and businesses.</li>
          <li>Benefit from low operational costs and high scalability.</li>
        </ul>
        <div>
          <Button onClick={() => router.push("/become-provider")} variant={"default"}>
            Become a Provider
          </Button>
        </div>
      </Card>
    </div>
  );
}
