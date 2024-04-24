import React from "react";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { Copyright, Youtube, Twitter, Github, Discord } from "iconoir-react";
import { Title } from "../shared/Title";

export interface IFooterProps {}

// export const useStyles = makeStyles()(theme => ({

//   link: {
//     fontWeight: "bold",
//     textDecoration: "underline"
//   },
//   title: {
//     fontSize: "1.5rem",
//     fontWeight: "bold",
//     marginBottom: ".5rem"
//   },
//   subSitle: {
//     fontSize: ".9rem",
//     fontWeight: 300
//   },
//   donationLabel: {
//     maxWidth: "15rem"
//   },
//   sectionTitle: {
//     fontWeight: "normal",
//     padding: ".5rem 0",
//     fontSize: "1rem"
//   },
//   socialLinks: {
//     listStyle: "none",
//     display: "flex",
//     padding: 0,
//     margin: 0,
//     [theme.breakpoints.down("sm")]: {
//       justifyContent: "center"
//     }
//   },
//   socialLink: {
//     display: "block",
//     padding: ".5rem 1rem",
//     transition: ".3s all ease",
//     "& path": {
//       fill: theme.palette.mode === "dark" ? theme.palette.primary.contrastText : theme.palette.primary.main,
//       transition: ".3s all ease"
//     },
//     "&:hover": {
//       color: theme.palette.secondary.main,
//       "& path": {
//         fill: theme.palette.secondary.main
//       }
//     }
//   },
//   socialIcon: {
//     height: "1.5rem",
//     width: "1.5rem",
//     fontSize: "3rem",
//     display: "block",
//     margin: "0 auto"
//   },
//   meta: {
//     display: "flex",
//     alignItems: "center",
//     height: "5rem",
//     justifyContent: "space-between",
//     [theme.breakpoints.down("sm")]: {
//       flexDirection: "column",
//       marginBottom: "1rem"
//     }
//   },
//   footerLink: {
//     color: "inherit"
//   }
// }));

export const Footer: React.FunctionComponent<IFooterProps> = () => {
  const year = new Date().getFullYear();

  return (
    <div className="mt-20 pb-12 text-center sm:text-left">
      <footer>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Title subTitle>Akash Console</Title>
            <p className="text-sm font-light">
              Akash Console is the #1 platform to deploy docker containers on the Akash Network, a decentralized cloud compute marketplace. Explore, deploy and
              track all in one place!
            </p>
          </div>
        </div>

        <div className="mb-4 flex h-20 flex-col items-center justify-between sm:mb-0 sm:flex-row">
          <ul className="flex items-center justify-center sm:justify-normal">
            <li>
              <a
                href="https://discord.gg/akash"
                target="_blank"
                className="block px-4 py-2 transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
              >
                <Discord className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
            <li>
              <a
                href="https://www.youtube.com/channel/UC1rgl1y8mtcQoa9R_RWO0UA?sub_confirmation=1"
                target="_blank"
                className="block px-4 py-2 transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
              >
                <Youtube className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
            <li>
              <a
                href="https://twitter.com/cloudmosio"
                target="_blank"
                className="block px-4 py-2 transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
              >
                <Twitter className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
            <li>
              <a
                href="https://github.com/akash-network/cloudmos"
                target="_blank"
                className="block px-4 py-2 transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary"
              >
                <Github className="mx-auto block h-6 w-6 text-5xl" />
              </a>
            </li>
          </ul>

          <div className="mb-4 mt-2 flex items-center sm:mb-0 sm:mt-0">
            <Link href={UrlService.termsOfService()} className="text-current">
              <p className="text-sm text-muted-foreground">Terms of Service</p>
            </Link>

            <div className="ml-4">
              <Link href={UrlService.privacyPolicy()} className="text-current">
                <p className="text-sm text-muted-foreground">Privacy Policy</p>
              </Link>
            </div>

            <div className="ml-4">
              <Link href={UrlService.faq()} className="text-current">
                <p className="text-sm text-muted-foreground">FAQ</p>
              </Link>
            </div>

            <div className="ml-4">
              <Link href={UrlService.contact()} className="text-current">
                <p className="text-sm text-muted-foreground">Contact</p>
              </Link>
            </div>
          </div>

          <p className="text-balance flex items-center text-center text-sm leading-loose text-muted-foreground md:text-left">
            <Copyright className="text-xs" />
            &nbsp;Akash Network {year}
          </p>
        </div>
      </footer>
    </div>
  );
};
