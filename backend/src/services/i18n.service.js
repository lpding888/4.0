const logger = require('../utils/logger');
const { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require('../config/i18n-messages');

/**
 * 国际化服务类
 *
 * 提供多语言支持功能：
 * - 语言检测和协商
 * - 消息本地化
 * - 动态语言切换
 * - 缓存优化
 */
class I18nService {
  constructor() {
    this.initialized = false;
    this.cache = new Map(); // 缓存已解析的语言配置
    this.cacheMaxSize = 100; // 最大缓存条目数
    this.defaultLocale = DEFAULT_LANGUAGE;
    this.supportedLocales = Object.keys(SUPPORTED_LANGUAGES);
  }

  /**
   * 初始化国际化服务
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('[I18nService] Initializing internationalization service...');

      // 验证支持的语言配置
      this.validateSupportedLanguages();

      // 设置缓存清理定时器
      this.setupCacheCleanup();

      this.initialized = true;
      logger.info('[I18nService] Internationalization service initialized successfully');

    } catch (error) {
      logger.error('[I18nService] Failed to initialize internationalization service:', error);
      throw error;
    }
  }

  /**
   * 验证支持的语言配置
   */
  validateSupportedLanguages() {
    for (const [locale, config] of Object.entries(SUPPORTED_LANGUAGES)) {
      if (!config.name || !config.messages) {
        throw new Error(`Invalid language configuration for locale: ${locale}`);
      }

      // 验证消息键的一致性
      const messageKeys = Object.keys(config.messages);
      if (messageKeys.length === 0) {
        logger.warn(`[I18nService] No messages found for locale: ${locale}`);
      }
    }

    logger.info(`[I18nService] Validated ${this.supportedLocales.length} supported languages`);
  }

  /**
   * 设置缓存清理定时器
   */
  setupCacheCleanup() {
    // 每小时清理一次缓存
    setInterval(() => {
      this.cleanupCache();
    }, 60 * 60 * 1000);
  }

  /**
   * 清理缓存
   */
  cleanupCache() {
    if (this.cache.size > this.cacheMaxSize) {
      // 删除最旧的条目（FIFO）
      const entriesToDelete = this.cache.size - this.cacheMaxSize;
      const keys = Array.from(this.cache.keys());

      for (let i = 0; i < entriesToDelete; i++) {
        this.cache.delete(keys[i]);
      }

      logger.debug(`[I18nService] Cleaned up ${entriesToDelete} cache entries`);
    }
  }

  /**
   * 从请求中检测首选语言
   * @param {Object} req - Express请求对象
   * @returns {string} 检测到的语言代码
   */
  detectLanguage(req) {
    // 优先级：用户设置 > 请求头 > 默认语言

    // 1. 检查用户设置的语言（如果用户已登录）
    if (req.user && req.user.language) {
      const userLanguage = req.user.language;
      if (this.isSupported(userLanguage)) {
        return userLanguage;
      }
    }

    // 2. 检查Accept-Language头
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      const preferredLanguage = this.parseAcceptLanguage(acceptLanguage);
      if (preferredLanguage) {
        return preferredLanguage;
      }
    }

    // 3. 检查查询参数
    const queryLanguage = req.query.lang || req.query.locale;
    if (queryLanguage && this.isSupported(queryLanguage)) {
      return queryLanguage;
    }

    // 4. 检查Cookie
    const cookieLanguage = this.getLanguageFromCookie(req);
    if (cookieLanguage) {
      return cookieLanguage;
    }

    // 5. 返回默认语言
    return this.defaultLocale;
  }

  /**
   * 解析Accept-Language头
   * @param {string} acceptLanguage - Accept-Language头的值
   * @returns {string|null} 首选语言代码
   */
  parseAcceptLanguage(acceptLanguage) {
    try {
      // 解析语言偏好列表
      const languages = acceptLanguage
        .split(',')
        .map(lang => {
          const [locale, quality = '1'] = lang.trim().split(';q=');
          return {
            locale: locale.toLowerCase(),
            quality: parseFloat(quality)
          };
        })
        .sort((a, b) => b.quality - a.quality);

      // 查找第一个支持的语言
      for (const { locale } of languages) {
        // 精确匹配
        if (this.isSupported(locale)) {
          return locale;
        }

        // 匹配主语言（如 zh-CN 匹配 zh）
        const mainLanguage = locale.split('-')[0];
        const matchedLocale = this.supportedLocales.find(supported =>
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

  /**
   * 从Cookie中获取语言设置
   * @param {Object} req - Express请求对象
   * @returns {string|null} 语言代码
   */
  getLanguageFromCookie(req) {
    try {
      const cookies = req.headers.cookie || '';
      const languageMatch = cookies.match(/(?:^|; )language=([^;]+)/);
      if (languageMatch) {
        const language = decodeURIComponent(languageMatch[1]);
        if (this.isSupported(language)) {
          return language;
        }
      }
    } catch (error) {
      logger.warn('[I18nService] Failed to parse language cookie:', error);
    }
    return null;
  }

  /**
   * 检查是否支持指定的语言
   * @param {string} locale - 语言代码
   * @returns {boolean}
   */
  isSupported(locale) {
    return this.supportedLocales.includes(locale);
  }

  /**
   * 获取本地化消息
   * @param {string} key - 消息键
   * @param {string} [locale] - 语言代码
   * @param {Object} [variables] - 消息变量
   * @returns {string} 本地化消息
   */
  getMessage(key, locale = this.defaultLocale, variables = {}) {
    // 确保语言受支持
    const targetLocale = this.isSupported(locale) ? locale : this.defaultLocale;

    // 从缓存获取
    const cacheKey = `${targetLocale}:${key}`;
    if (this.cache.has(cacheKey)) {
      const message = this.cache.get(cacheKey);
      return this.interpolateVariables(message, variables);
    }

    // 从配置获取
    const languageConfig = SUPPORTED_LANGUAGES[targetLocale];
    if (!languageConfig || !languageConfig.messages) {
      logger.warn(`[I18nService] Language config not found for locale: ${targetLocale}`);
      return this.getMessage(key, this.defaultLocale, variables);
    }

    const message = languageConfig.messages[key] || key;

    // 缓存消息
    if (this.cache.size < this.cacheMaxSize) {
      this.cache.set(cacheKey, message);
    }

    return this.interpolateVariables(message, variables);
  }

  /**
   * 插入变量到消息中
   * @param {string} message - 消息模板
   * @param {Object} variables - 变量对象
   * @returns {string} 处理后的消息
   */
  interpolateVariables(message, variables) {
    if (!variables || Object.keys(variables).length === 0) {
      return message;
    }

    return message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  /**
   * 获取错误消息
   * @param {number} errorCode - 错误码
   * @param {string} [locale] - 语言代码
   * @param {Object} [variables] - 消息变量
   * @returns {string} 本地化错误消息
   */
  getErrorMessage(errorCode, locale = this.defaultLocale, variables = {}) {
    return this.getMessage(errorCode.toString(), locale, variables);
  }

  /**
   * 格式化数字
   * @param {number} number - 数字
   * @param {string} [locale] - 语言代码
   * @returns {string} 格式化的数字
   */
  formatNumber(number, locale = this.defaultLocale) {
    try {
      return new Intl.NumberFormat(locale).format(number);
    } catch (error) {
      logger.warn(`[I18nService] Failed to format number for locale ${locale}:`, error);
      return number.toString();
    }
  }

  /**
   * 格式化日期
   * @param {Date|string|number} date - 日期
   * @param {string} [locale] - 语言代码
   * @param {Object} [options] - 格式化选项
   * @returns {string} 格式化的日期
   */
  formatDate(date, locale = this.defaultLocale, options = {}) {
    try {
      const dateObj = new Date(date);
      const defaultOptions = {
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

  /**
   * 格式化货币
   * @param {number} amount - 金额
   * @param {string} [currency] - 货币代码
   * @param {string} [locale] - 语言代码
   * @returns {string} 格式化的货币
   */
  formatCurrency(amount, currency = 'CNY', locale = this.defaultLocale) {
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
      }).format(amount);
    } catch (error) {
      logger.warn(`[I18nService] Failed to format currency for locale ${locale}:`, error);
      return `${currency} ${amount}`;
    }
  }

  /**
   * 格式化相对时间
   * @param {Date|string|number} date - 日期
   * @param {string} [locale] - 语言代码
   * @returns {string} 相对时间描述
   */
  formatRelativeTime(date, locale = this.defaultLocale) {
    try {
      const dateObj = new Date(date);
      const now = new Date();
      const diffInSeconds = Math.floor((now - dateObj) / 1000);

      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

      if (Math.abs(diffInSeconds) < 60) {
        return rtf.format(-diffInSeconds, 'second');
      } else if (Math.abs(diffInSeconds) < 3600) {
        return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
      } else if (Math.abs(diffInSeconds) < 86400) {
        return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
      } else {
        return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
      }
    } catch (error) {
      logger.warn(`[I18nService] Failed to format relative time for locale ${locale}:`, error);
      return new Date(date).toLocaleString();
    }
  }

  /**
   * 获取支持的语言列表
   * @returns {Array} 语言列表
   */
  getSupportedLanguages() {
    return this.supportedLocales.map(locale => ({
      code: locale,
      name: SUPPORTED_LANGUAGES[locale].name,
      isDefault: locale === this.defaultLocale
    }));
  }

  /**
   * 设置语言Cookie
   * @param {Object} res - Express响应对象
   * @param {string} locale - 语言代码
   * @param {Object} [options] - Cookie选项
   */
  setLanguageCookie(res, locale, options = {}) {
    const defaultOptions = {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1年
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      ...options
    };

    res.cookie('language', locale, defaultOptions);
  }

  /**
   * 中间件：为请求添加国际化功能
   * @returns {Function} Express中间件
   */
  middleware() {
    return (req, res, next) => {
      // 检测语言
      const detectedLanguage = this.detectLanguage(req);

      // 创建i18n对象
      req.i18n = {
        locale: detectedLanguage,
        getMessage: (key, variables) => this.getMessage(key, detectedLanguage, variables),
        getErrorMessage: (code, variables) => this.getErrorMessage(code, detectedLanguage, variables),
        formatNumber: (number) => this.formatNumber(number, detectedLanguage),
        formatDate: (date, options) => this.formatDate(date, detectedLanguage, options),
        formatCurrency: (amount, currency) => this.formatCurrency(amount, currency, detectedLanguage),
        formatRelativeTime: (date) => this.formatRelativeTime(date, detectedLanguage),
        setLanguage: (locale) => {
          if (this.isSupported(locale)) {
            req.i18n.locale = locale;
            this.setLanguageCookie(res, locale);
          }
        }
      };

      // 设置语言Cookie（如果与当前不同）
      if (req.cookies.language !== detectedLanguage) {
        this.setLanguageCookie(res, detectedLanguage);
      }

      next();
    };
  }

  /**
   * 获取服务统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      initialized: this.initialized,
      supportedLanguages: this.supportedLocales.length,
      defaultLocale: this.defaultLocale,
      cacheSize: this.cache.size,
      cacheMaxSize: this.cacheMaxSize
    };
  }

  /**
   * 关闭服务
   */
  async close() {
    try {
      this.cache.clear();
      this.initialized = false;
      logger.info('[I18nService] Internationalization service closed');
    } catch (error) {
      logger.error('[I18nService] Error closing internationalization service:', error);
    }
  }
}

module.exports = new I18nService();