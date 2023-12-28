"use client";
import { ModeToggle } from "./ModeToggle";
import { FaGithub, FaBars, FaXTwitter } from "react-icons/fa6";
import { Button } from "./ui/button";
import { AkashConsoleLogo } from "./icons/AkashConsoleLogo";
import Link from "next/link";

export const Nav = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link className="mr-6 flex items-center space-x-2" href="/">
            <AkashConsoleLogo />
          </Link>
          {/* <nav className="flex items-center space-x-6 text-sm font-medium">
            <a className="text-foreground/60 transition-colors hover:text-foreground/80" href="/docs">
              Documentation
            </a>
            <a className="text-foreground transition-colors hover:text-foreground/80" href="/docs/components">
              Components
            </a>
            <a className="text-foreground/60 transition-colors hover:text-foreground/80" href="/themes">
              Themes
            </a>
            <a className="text-foreground/60 transition-colors hover:text-foreground/80" href="/examples">
              Examples
            </a>
            <a className="hidden text-foreground/60 transition-colors hover:text-foreground/80 lg:block" href="https://github.com/shadcn-ui/ui">
              GitHub
            </a>
          </nav> */}
        </div>

        {/* <button
          className="mr-2 inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md px-0 py-2 text-base font-medium transition-colors hover:bg-transparent hover:text-accent-foreground focus-visible:bg-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 md:hidden"
          type="button"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-controls="radix-:R15hja:"
          data-state="closed"
        >
          
        </button> */}
        <div className="flex flex-1 items-center justify-end">
          <Button className="md:hidden">
            <FaBars />
            <span className="sr-only">Toggle Menu</span>
          </Button>

          <nav className="hidden items-center md:flex">
            <a target="_blank" rel="noreferrer" href="https://github.com/akash-network/cloudmos">
              <Button variant="ghost" size="icon">
                <FaGithub />
                <span className="sr-only">GitHub</span>
              </Button>
            </a>
            <a target="_blank" rel="noreferrer" href="https://twitter.com/akashnet_">
              <Button variant="ghost" size="icon">
                <FaXTwitter />
                <span className="sr-only">Twitter</span>
              </Button>
            </a>

            <ModeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
};
