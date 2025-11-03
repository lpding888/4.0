/**
 * 支付配置文件
 *
 * 支持支付宝和微信支付的配置管理
 */

module.exports = {
  // 支付宝配置
  alipay: {
    // 正式环境配置
    prod: {
      appId: process.env.ALIPAY_APP_ID || '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
      publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
      gateway: 'https://openapi.alipay.com/gateway.do',
      charset: 'utf-8',
      version: '1.0',
      signType: 'RSA2'
    },
    // 沙箱环境配置
    dev: {
      appId: process.env.ALIPAY_DEV_APP_ID || '',
      privateKey: process.env.ALIPAY_DEV_PRIVATE_KEY || '',
      publicKey: process.env.ALIPAY_DEV_PUBLIC_KEY || '',
      gateway: 'https://openapi.alipaydev.com/gateway.do',
      charset: 'utf-8',
      version: '1.0',
      signType: 'RSA2'
    },
    // 回调地址配置
    callbacks: {
      notify: process.env.ALIPAY_NOTIFY_URL || 'https://api.example.com/api/payment/alipay/notify',
      return: process.env.ALIPAY_RETURN_URL || 'https://app.example.com/payment/success'
    }
  },

  // 微信支付配置
  wechat: {
    // 正式环境配置
    prod: {
      appId: process.env.WECHAT_APP_ID || '',
      mchId: process.env.WECHAT_MCH_ID || '',
      privateKey: process.env.WECHAT_PRIVATE_KEY || '',
      publicKey: process.env.WECHAT_PUBLIC_KEY || '',
      apiV3Key: process.env.WECHAT_API_V3_KEY || '',
      merchantSerialNumber: process.env.WECHAT_MERCHANT_SERIAL_NO || '',
      keyPath: process.env.WECHAT_KEY_PATH || '',
      certPath: process.env.WECHAT_CERT_PATH || ''
    },
    // 沙箱环境配置
    dev: {
      appId: process.env.WECHAT_DEV_APP_ID || '',
      mchId: process.env.WECHAT_DEV_MCH_ID || '',
      privateKey: process.env.WECHAT_DEV_PRIVATE_KEY || '',
      publicKey: process.env.WECHAT_DEV_PUBLIC_KEY || '',
      apiV3Key: process.env.WECHAT_DEV_API_V3_KEY || '',
      merchantSerialNumber: process.env.WECHAT_DEV_MERCHANT_SERIAL_NO || '',
      keyPath: process.env.WECHAT_DEV_KEY_PATH || '',
      certPath: process.env.WECHAT_DEV_CERT_PATH || ''
    },
    // 回调地址配置
    callbacks: {
      notify: process.env.WECHAT_NOTIFY_URL || 'https://api.example.com/api/payment/wechat/notify',
      return: process.env.WECHAT_RETURN_URL || 'https://app.example.com/payment/success'
    }
  },

  // 通用配置
  common: {
    // 超时配置
    timeout: {
      orderExpireMinutes: 30, // 订单过期时间(分钟)
      refundExpireDays: 7,    // 退款过期时间(天)
      callbackTimeout: 30000   // 回调超时时间(毫秒)
    },
    // 重试配置
    retry: {
      maxRetries: 3,
      retryInterval: 1000 // 毫秒
    },
    // 安全配置
    security: {
      signCheck: true,           // 签名验证
      ipCheck: true,            // IP检查
      amountCheck: true,        // 金额验证
      notifyCheck: true         // 回调验证
    }
  },

  // 商品类型配置
  products: {
    membership: {
      name: '会员服务',
      type: 'virtual',
      currency: 'CNY'
    },
    quota: {
      name: '配额购买',
      type: 'virtual',
      currency: 'CNY'
    },
    premium: {
      name: '高级功能',
      type: 'virtual',
      currency: 'CNY'
    }
  },

  // 获取当前环境配置
  getConfig: function(provider, env = process.env.NODE_ENV || 'development') {
    const config = this[provider];
    if (!config) {
      throw new Error(`不支持的支付提供商: ${provider}`);
    }

    const envConfig = env === 'production' ? config.prod : config.dev;
    return {
      ...envConfig,
      callbacks: config.callbacks
    };
  },

  // 获取商品配置
  getProductConfig: function(productType) {
    const product = this.products[productType];
    if (!product) {
      throw new Error(`不支持的商品类型: ${productType}`);
    }
    return product;
  },

  // 验证配置完整性
  validateConfig: function(provider, env = process.env.NODE_ENV || 'development') {
    const config = this.getConfig(provider, env);
    const errors = [];

    if (provider === 'alipay') {
      if (!config.appId) errors.push('支付宝AppId缺失');
      if (!config.privateKey) errors.push('支付宝私钥缺失');
      if (!config.publicKey) errors.push('支付宝公钥缺失');
      if (!config.gateway) errors.push('支付宝网关地址缺失');
    } else if (provider === 'wechat') {
      if (!config.appId) errors.push('微信AppId缺失');
      if (!config.mchId) errors.push('微信商户号缺失');
      if (!config.privateKey) errors.push('微信私钥缺失');
      if (!config.apiV3Key) errors.push('微信API v3密钥缺失');
    }

    if (errors.length > 0) {
      throw new Error(`${provider}配置不完整: ${errors.join(', ')}`);
    }

    return true;
  }
};