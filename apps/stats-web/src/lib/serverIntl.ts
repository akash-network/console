'server-only';

import { createIntl } from '@formatjs/intl';

export default async function getIntl(locale: string, namespace: string) {
  return createIntl({
    locale: locale,
    messages: (await import(`@/messages/${locale}/${namespace}.json`)).default
  });
}