"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var iconoir_react_1 = require("iconoir-react");
var Layout_1 = require("@src/components/layout/Layout");
var Title_1 = require("@src/components/shared/Title");
var urlUtils_1 = require("@src/utils/urlUtils");
var CustomNextSeo_1 = require("../components/shared/CustomNextSeo");
var ContactPage = function () {
    return (<Layout_1.default>
      <CustomNextSeo_1.CustomNextSeo title="Contact" url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.contact())}/>

      <div className="py-12 text-center">
        <Title_1.Title>Contact us</Title_1.Title>

        <div className="space-y-1 pt-4">
          <p className="text-lg">Need help or have an issue with something?</p>
          <p className="text-sm">The best way to reach us is through our discord server or twitter.</p>
        </div>

        <ul className="flex items-center justify-center py-8">
          <li>
            <a href="https://discord.gg/akash" target="_blank" className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary">
              <iconoir_react_1.Discord className="mx-auto block h-6 w-6 text-5xl"/>
            </a>
          </li>
          <li>
            <a href="https://youtube.com/@AkashNetwork?si=cd2P3ZlAa4gNQw0X?sub_confirmation=1" target="_blank" className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary">
              <iconoir_react_1.Youtube className="mx-auto block h-6 w-6 text-5xl"/>
            </a>
          </li>
          <li>
            <a href="https://twitter.com/akashnet" target="_blank" className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary">
              <iconoir_react_1.X className="mx-auto block h-6 w-6 text-5xl"/>
            </a>
          </li>
          <li>
            <a href="https://github.com/akash-network/console" target="_blank" className="block px-4 py-2 text-current transition-all duration-300 hover:text-primary [&>path]:fill-muted-foreground/20 hover:[&>path]:fill-primary">
              <iconoir_react_1.Github className="mx-auto block h-6 w-6 text-5xl"/>
            </a>
          </li>
        </ul>
      </div>
    </Layout_1.default>);
};
exports.default = ContactPage;
