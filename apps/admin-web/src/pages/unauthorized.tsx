"use client";
import { Button } from "@akashnetwork/ui/components";
import { useUser } from "@auth0/nextjs-auth0/client";
import Head from "next/head";

export default function UnauthorizedPage() {
  const { user } = useUser();

  return (
    <>
      <Head>
        <title>Access Denied | Akash Admin</title>
      </Head>
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">The Admin Dashboard is restricted to @akash.network accounts only.</p>
          {user?.email && <p className="text-muted-foreground text-sm">Logged in as: {user.email}</p>}
          <Button asChild>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/auth/logout">Sign Out</a>
          </Button>
        </div>
      </div>
    </>
  );
}
