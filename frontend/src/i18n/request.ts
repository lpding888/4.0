/**
 * I18N-P2-LOCALE-209: next-intl 配置
 * 艹！国际化配置，支持中英文切换！
 *
 * @author 老王
 */

import { getRequestConfig } from 'next-intl/server';

export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
  const resolvedLocale: Locale = locales.includes(locale as Locale)
    ? (locale as Locale)
    : 'zh';

  return {
    locale: resolvedLocale,
    messages: (await import(`./messages/${resolvedLocale}.json`)).default
  };
});
