/**
 * I18N-P2-LOCALE-209: next-intl 配置
 * 艹！国际化配置，支持中英文切换！
 *
 * @author 老王
 */

import { getRequestConfig } from 'next-intl/server';

export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));
