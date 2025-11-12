"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Footer = void 0;
var react_1 = require("react");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var urlUtils_1 = require("@src/utils/urlUtils");
var Title_1 = require("../shared/Title");
var Footer = function () {
    var year = new Date().getFullYear();
    return (<div className="mt-20 pb-12 text-center sm:text-left">
      <footer>
        <div className="mb-4 grid grid-cols-1 gap-4">
          <div>
            <Title_1.Title subTitle className="mb-2 tracking-tight">
              Akash Console
            </Title_1.Title>
            <p className="text-sm font-light">
              Akash Console is the #1 platform to deploy docker containers on the Akash Network, a decentralized cloud compute marketplace. Explore, deploy and
              track all in one place!
            </p>
          </div>
        </div>

        <div className="mb-4 flex h-20 flex-col items-center justify-between sm:mb-0 sm:flex-row">
          <div className="mb-4 mt-2 flex items-center sm:mb-0 sm:mt-0">
            <link_1.default href={urlUtils_1.UrlService.termsOfService()} className="text-current">
              <p className="text-sm text-muted-foreground">Terms of Service</p>
            </link_1.default>

            <div className="ml-4">
              <link_1.default href={urlUtils_1.UrlService.privacyPolicy()} className="text-current">
                <p className="text-sm text-muted-foreground">Privacy Policy</p>
              </link_1.default>
            </div>

            <div className="ml-4">
              <link_1.default href={urlUtils_1.UrlService.faq()} className="text-current">
                <p className="text-sm text-muted-foreground">FAQ</p>
              </link_1.default>
            </div>

            <div className="ml-4">
              <link_1.default href={urlUtils_1.UrlService.contact()} className="text-current">
                <p className="text-sm text-muted-foreground">Contact</p>
              </link_1.default>
            </div>
          </div>

          <p className="flex items-center text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            <iconoir_react_1.Copyright className="text-xs"/>
            &nbsp;Akash Network {year}
          </p>
        </div>
      </footer>
    </div>);
};
exports.Footer = Footer;
