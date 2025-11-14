import type { Request, Response, NextFunction } from 'express';
import type { CookieOptions } from 'express';
import logger from '../utils/logger.js';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  type SupportedLanguageCode,
  type LocaleMessages
} from '../config/i18n-messages.js';

export type MessageVariables = Record<string, unknown>;

export interface I18nContext {
  locale: SupportedLanguageCode;
  getMessage: (key: string, variables?: MessageVariables) => string;
  getErrorMessage: (code: string | number, variables?: MessageVariables) => string;
  formatNumber: (value: number) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatRelativeTime: (value: Date | string | number) => string;
  setLanguage: (locale: string) => void;
}

type LocaleCache = Map<string, string>;

type AcceptLanguageEntry = {
  locale: string;
  quality: number;
};

class I18nService {
  private initialized = false;

  private readonly cache: LocaleCache = new Map();

  private readonly cacheMaxSize = 100;

  private readonly defaultLocale: SupportedLanguageCode = DEFAULT_LANGUAGE;

  private readonly supportedLocales: SupportedLanguageCode[] = Object.keys(
    SUPPORTED_LANGUAGES
  ) as SupportedLanguageCode[];

  private cacheCleanupTimer?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('[I18nService] Initializing internationalization service...');
    this.validateSupportedLanguages();
    this.setupCacheCleanup();
    this.initialized = true;
    logger.info('[I18nService] Internationalization service initialized successfully');
  }

  private validateSupportedLanguages(): void {
    for (const [locale, config] of Object.entries(SUPPORTED_LANGUAGES)) {
      if (!config.name || !config.messages) {
        throw new Error(`Invalid language configuration for locale: ${locale}`);
      }

      if (Object.keys(config.messages).length === 0) {
        logger.warn(`[I18nService] No messages found for locale: ${locale}`);
      }
    }

    logger.info(`[I18nService] Validated ${this.supportedLocales.length} supported languages`);
  }

  private setupCacheCleanup(): void {
    this.cacheCleanupTimer = setInterval(() => this.cleanupCache(), 60 * 60 * 1000);
  }

  private cleanupCache(): void {
    if (this.cache.size <= this.cacheMaxSize) {
      return;
    }

    const entriesToDelete = this.cache.size - this.cacheMaxSize;
    const keys = Array.from(this.cache.keys());

    for (let i = 0; i < entriesToDelete; i += 1) {
      this.cache.delete(keys[i]);
    }

    logger.debug(`[I18nService] Cleaned up ${entriesToDelete} cache entries`);
  }

  detectLanguage(req: Request): SupportedLanguageCode {
    const userLanguage = (req as Request & { user?: { language?: string } }).user?.language;
    if (this.isSupported(userLanguage)) {
      return userLanguage;
    }

    const acceptLanguageHeader = req.headers['accept-language'];
    if (typeof acceptLanguageHeader === 'string') {
      const preferred = this.parseAcceptLanguage(acceptLanguageHeader);
      if (preferred) {
        return preferred;
      }
    } else if (Array.isArray(acceptLanguageHeader)) {
      for (const header of acceptLanguageHeader as string[]) {
        const preferred = this.parseAcceptLanguage(header);
        if (preferred) {
          return preferred;
        }
      }
    }

    const queryLanguage = (req.query.lang ?? req.query.locale) as string | string[] | undefined;
    const queryValue = Array.isArray(queryLanguage) ? queryLanguage[0] : queryLanguage;
    if (queryValue && this.isSupported(queryValue)) {
      return queryValue;
    }

    const cookieLanguage = this.getLanguageFromCookie(req);
    if (cookieLanguage) {
      return cookieLanguage;
    }

    return this.defaultLocale;
  }

  private parseAcceptLanguage(value: string): SupportedLanguageCode | null {
    try {
      const languages: AcceptLanguageEntry[] = value
        .split(',')
        .map((lang) => {
          const [locale, quality = '1'] = lang.trim().split(';q=');
          return {
            locale: locale.toLowerCase(),
            quality: parseFloat(quality)
          };
        })
        .sort((a, b) => b.quality - a.quality);

      for (const { locale } of languages) {
        if (this.isSupported(locale)) {
          return locale;
        }

        const mainLanguage = locale.split('-')[0];
        const matchedLocale = this.supportedLocales.find((supported) =>
          supported.toLowerCase().startsWith(mainLanguage)
        );
        if (matchedLocale) {
          return matchedLocale;
        }
      }
    } catch (error) {
      logger.warn('[I18nService] Failed to parse Accept-Language header:', error);
    }

    return null;
  }

  private getLanguageFromCookie(req: Request): SupportedLanguageCode | null {
    try {
      const cookieHeader = req.headers.cookie || '';
      const match = cookieHeader.match(/(?:^|; )language=([^;]+)/);
      if (match) {
        const value = decodeURIComponent(match[1]);
        if (this.isSupported(value)) {
          return value;
        }
      }
    } catch (error) {
      logger.warn('[I18nService] Failed to parse language cookie:', error);
    }
    return null;
  }

  private isSupported(locale: unknown): locale is SupportedLanguageCode {
    return (
      typeof locale === 'string' && this.supportedLocales.includes(locale as SupportedLanguageCode)
    );
  }

  getMessage(
    key: string,
    locale: SupportedLanguageCode = this.defaultLocale,
    variables: MessageVariables = {}
  ): string {
    const targetLocale = this.isSupported(locale) ? locale : this.defaultLocale;
    const cacheKey = `${targetLocale}:${key}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey) as string;
      return this.interpolateVariables(cached, variables);
    }

    const languageConfig = SUPPORTED_LANGUAGES[targetLocale];
    if (!languageConfig?.messages) {
      logger.warn(`[I18nService] Language config not found for locale: ${targetLocale}`);
      return this.getMessage(key, this.defaultLocale, variables);
    }

    const message = (languageConfig.messages as Record<string, string>)[key] ?? key;

    if (this.cache.size < this.cacheMaxSize) {
      this.cache.set(cacheKey, message);
    }

    return this.interpolateVariables(message, variables);
  }

  private interpolateVariables(message: string, variables: MessageVariables): string {
    if (!variables || Object.keys(variables).length === 0) {
      return message;
    }

    return message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  getErrorMessage(
    errorCode: string | number,
    locale: SupportedLanguageCode = this.defaultLocale,
    variables: MessageVariables = {}
  ): string {
    return this.getMessage(errorCode.toString(), locale, variables);
  }

  formatNumber(value: number, locale: SupportedLanguageCode = this.defaultLocale): string {
    try {
      return new Intl.NumberFormat(locale).format(value);
    } catch (error) {
      logger.warn(`[I18nService] Failed to format number for locale ${locale}:`, error);
      return value.toString();
    }
  }

  formatDate(
    date: Date | string | number,
    locale: SupportedLanguageCode = this.defaultLocale,
    options: Intl.DateTimeFormatOptions = {}
  ): string {
    try {
      const dateObj = new Date(date);
      const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options
      };
      return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
    } catch (error) {
      logger.warn(`[I18nService] Failed to format date for locale ${locale}:`, error);
      return new Date(date).toLocaleString();
    }
  }

  formatCurrency(
    amount: number,
    currency = 'CNY',
    locale: SupportedLanguageCode = this.defaultLocale
  ): string {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency
      }).format(amount);
    } catch (error) {
      logger.warn(`[I18nService] Failed to format currency for locale ${locale}:`, error);
      return amount.toString();
    }
  }

  formatRelativeTime(
    date: Date | string | number,
    locale: SupportedLanguageCode = this.defaultLocale
  ): string {
    try {
      const dateObj = new Date(date);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

      if (Math.abs(diffInSeconds) < 60) {
        return rtf.format(-diffInSeconds, 'second');
      }
      if (Math.abs(diffInSeconds) < 3600) {
        return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
      }
      if (Math.abs(diffInSeconds) < 86400) {
        return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
      }
      return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
    } catch (error) {
      logger.warn(`[I18nService] Failed to format relative time for locale ${locale}:`, error);
      return new Date(date).toLocaleString();
    }
  }

  getSupportedLanguages(): Array<{
    code: SupportedLanguageCode;
    name: string;
    isDefault: boolean;
  }> {
    return this.supportedLocales.map((locale) => ({
      code: locale,
      name: SUPPORTED_LANGUAGES[locale].name,
      isDefault: locale === this.defaultLocale
    }));
  }

  setLanguageCookie(
    res: Response,
    locale: SupportedLanguageCode,
    options: CookieOptions = {}
  ): void {
    const defaultOptions: CookieOptions = {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      ...options
    };

    res.cookie('language', locale, defaultOptions);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const detectedLanguage = this.detectLanguage(req);

      const context: I18nContext = {
        locale: detectedLanguage,
        getMessage: (key, vars) => this.getMessage(key, detectedLanguage, vars),
        getErrorMessage: (code, vars) => this.getErrorMessage(code, detectedLanguage, vars),
        formatNumber: (value) => this.formatNumber(value, detectedLanguage),
        formatDate: (value, options) => this.formatDate(value, detectedLanguage, options),
        formatCurrency: (amount, currency) =>
          this.formatCurrency(amount, currency, detectedLanguage),
        formatRelativeTime: (value) => this.formatRelativeTime(value, detectedLanguage),
        setLanguage: (locale: string) => {
          if (this.isSupported(locale as SupportedLanguageCode)) {
            const normalized = locale as SupportedLanguageCode;
            context.locale = normalized;
            this.setLanguageCookie(res, normalized);
          }
        }
      };

      req.i18n = context;

      if (req.cookies?.language !== detectedLanguage) {
        this.setLanguageCookie(res, detectedLanguage);
      }

      next();
    };
  }

  getStats() {
    return {
      initialized: this.initialized,
      supportedLanguages: this.supportedLocales.length,
      defaultLocale: this.defaultLocale,
      cacheSize: this.cache.size,
      cacheMaxSize: this.cacheMaxSize
    };
  }

  async close(): Promise<void> {
    this.cache.clear();
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = undefined;
    }
    this.initialized = false;
    logger.info('[I18nService] Internationalization service closed');
  }
}
const i18nService = new I18nService();
export default i18nService;
