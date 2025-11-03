/**
 * 微信登录配置文件
 *
 * 支持微信公众号、小程序、开放平台的登录配置
 */

module.exports = {
  // 微信公众号配置
  officialAccount: {
    // 正式环境
    prod: {
      appId: process.env.WECHAT_OFFICIAL_APPID || '',
      appSecret: process.env.WECHAT_OFFICIAL_SECRET || '',
      token: process.env.WECHAT_OFFICIAL_TOKEN || '',
      encodingAESKey: process.env.WECHAT_OFFICIAL_ENCODING_AES_KEY || ''
    },
    // 开发环境
    dev: {
      appId: process.env.WECHAT_OFFICIAL_DEV_APPID || '',
      appSecret: process.env.WECHAT_OFFICIAL_DEV_SECRET || '',
      token: process.env.WECHAT_OFFICIAL_DEV_TOKEN || '',
      encodingAESKey: process.env.WECHAT_OFFICIAL_DEV_ENCODING_AES_KEY || ''
    },
    // 回调地址
    callbacks: {
      oauth: process.env.WECHAT_OFFICIAL_OAUTH_CALLBACK || 'https://api.example.com/api/auth/wechat/official/callback',
      qr: process.env.WECHAT_OFFICIAL_QR_CALLBACK || 'https://api.example.com/api/auth/wechat/official/qr-callback'
    }
  },

  // 微信小程序配置
  miniProgram: {
    // 正式环境
    prod: {
      appId: process.env.WECHAT_MINI_APPID || '',
      appSecret: process.env.WECHAT_MINI_SECRET || ''
    },
    // 开发环境
    dev: {
      appId: process.env.WECHAT_MINI_DEV_APPID || '',
      appSecret: process.env.WECHAT_MINI_DEV_SECRET || ''
    }
  },

  // 微信开放平台配置
  openPlatform: {
    // 正式环境
    prod: {
      appId: process.env.WECHAT_OPEN_APPID || '',
      appSecret: process.env.WECHAT_OPEN_SECRET || '',
      componentAppId: process.env.WECHAT_COMPONENT_APPID || '',
      componentSecret: process.env.WECHAT_COMPONENT_SECRET || ''
    },
    // 开发环境
    dev: {
      appId: process.env.WECHAT_OPEN_DEV_APPID || '',
      appSecret: process.env.WECHAT_OPEN_DEV_SECRET || '',
      componentAppId: process.env.WECHAT_COMPONENT_DEV_APPID || '',
      componentSecret: process.env.WECHAT_COMPONENT_DEV_SECRET || ''
    },
    // 回调地址
    callbacks: {
      scan: process.env.WECHAT_OPEN_SCAN_CALLBACK || 'https://api.example.com/api/auth/wechat/open/scan-callback'
    }
  },

  // 微信支付配置（复用支付配置）
  wechatPay: {
    // 正式环境
    prod: {
      appId: process.env.WECHAT_APP_ID || '',
      mchId: process.env.WECHAT_MCH_ID || '',
      privateKey: process.env.WECHAT_PRIVATE_KEY || '',
      apiV3Key: process.env.WECHAT_API_V3_KEY || '',
      merchantSerialNumber: process.env.WECHAT_MERCHANT_SERIAL_NO || ''
    },
    // 开发环境
    dev: {
      appId: process.env.WECHAT_DEV_APP_ID || '',
      mchId: process.env.WECHAT_DEV_MCH_ID || '',
      privateKey: process.env.WECHAT_DEV_PRIVATE_KEY || '',
      apiV3Key: process.env.WECHAT_DEV_API_V3_KEY || '',
      merchantSerialNumber: process.env.WECHAT_DEV_MERCHANT_SERIAL_NO || ''
    }
  },

  // 通用配置
  common: {
    // 缓存配置
    cache: {
      accessTokenTTL: 7200,        // access_token缓存时间(秒)
      jsapiTicketTTL: 7200,        // jsapi_ticket缓存时间(秒)
      sessionTTL: 86400,           // 微信会话缓存时间(秒)
      userInfoTTL: 3600            // 用户信息缓存时间(秒)
    },
    // 安全配置
    security: {
      stateExpireMinutes: 10,      // state参数过期时间(分钟)
      signCheck: true,             // 签名验证
      ipCheck: true,               // IP检查
      sessionCheck: true           // 会话验证
    },
    // 重试配置
    retry: {
      maxRetries: 3,
      retryInterval: 1000          // 重试间隔(毫秒)
    },
    // API域名
    domains: {
      official: 'https://api.weixin.qq.com',
      open: 'https://open.weixin.qq.com',
      pay: 'https://api.mch.weixin.qq.com'
    }
  },

  // 获取当前环境配置
  getConfig: function(platform, env = process.env.NODE_ENV || 'development') {
    const config = this[platform];
    if (!config) {
      throw new Error(`不支持的微信平台: ${platform}`);
    }

    const envConfig = env === 'production' ? config.prod : config.dev;
    return {
      ...envConfig,
      callbacks: config.callbacks || {},
      domains: this.common.domains
    };
  },

  // 验证配置完整性
  validateConfig: function(platform, env = process.env.NODE_ENV || 'development') {
    const config = this.getConfig(platform, env);
    const errors = [];

    switch (platform) {
      case 'officialAccount':
        if (!config.appId) errors.push('微信公众号AppId缺失');
        if (!config.appSecret) errors.push('微信公众号AppSecret缺失');
        break;
      case 'miniProgram':
        if (!config.appId) errors.push('微信小程序AppId缺失');
        if (!config.appSecret) errors.push('微信小程序AppSecret缺失');
        break;
      case 'openPlatform':
        if (!config.appId) errors.push('微信开放平台AppId缺失');
        if (!config.appSecret) errors.push('微信开放平台AppSecret缺失');
        break;
    }

    if (errors.length > 0) {
      throw new Error(`${platform}配置不完整: ${errors.join(', ')}`);
    }

    return true;
  },

  // 获取微信API地址
  getApiUrl: function(platform, endpoint, env = process.env.NODE_ENV || 'development') {
    const config = this.getConfig(platform, env);
    let domain;

    switch (platform) {
      case 'officialAccount':
        domain = config.domains.official;
        break;
      case 'openPlatform':
        domain = config.domains.open;
        break;
      case 'wechatPay':
        domain = config.domains.pay;
        break;
      default:
        throw new Error(`不支持的微信平台: ${platform}`);
    }

    return `${domain}${endpoint}`;
  },

  // 生成state参数
  generateState: function() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 8);
    const state = Buffer.from(`${timestamp}_${random}`).toString('base64');
    return state.replace(/[+=]/g, '').substr(0, 32);
  },

  // 验证state参数
  verifyState: function(state, maxAge = 10 * 60 * 1000) {
    try {
      const decoded = Buffer.from(state + '==', 'base64').toString();
      const [timestamp] = decoded.split('_');
      const timestampMs = parseInt(timestamp, 10);

      if (!timestampMs || Date.now() - timestampMs > maxAge) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }
};