import Link from "next/link";

import type { ApiProviderList } from "@src/types/provider";
import { UrlService } from "@src/utils/urlUtils";
import { ShortenedValue } from "./ShortenedValue";

type Props = {
  provider: ApiProviderList;
};

export const ProviderName: React.FunctionComponent<Props> = ({ provider }) => {
  return provider.name ? (
    <Link href={UrlService.providerDetail(provider.owner)} onClick={e => e.stopPropagation()}>
      <ShortenedValue value={provider.name} maxLength={40} headLength={14} />
    </Link>
  ) : (
    <ShortenedValue value={provider.hostUri} maxLength={40} headLength={14} />
  );
};
