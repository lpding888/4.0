export type WechatPlatform = 'officialAccount' | 'miniProgram' | 'openPlatform' | 'wechatPay';
export type WechatEnvironment = 'development' | 'production';

interface OAuthCallbacks {
  oauth?: string;
  qr?: string;
  scan?: string;
}

interface OfficialAccountConfig {
  appId: string;
  appSecret: string;
  token: string;
  encodingAESKey: string;
}

interface MiniProgramConfig {
  appId: string;
  appSecret: string;
}

interface OpenPlatformConfig {
  appId: string;
  appSecret: string;
  componentAppId: string;
  componentSecret: string;
}

interface WechatPayConfig {
  appId: string;
  mchId: string;
  privateKey: string;
  apiV3Key: string;
  merchantSerialNumber: string;
}

type PlatformCredentials =
  | OfficialAccountConfig
  | MiniProgramConfig
  | OpenPlatformConfig
  | WechatPayConfig;

interface PlatformConfig<TCredentials extends PlatformCredentials> {
  prod: TCredentials;
  dev: TCredentials;
  callbacks?: OAuthCallbacks;
}

interface CommonConfig {
  cache: {
    accessTokenTTL: number;
    jsapiTicketTTL: number;
    sessionTTL: number;
    userInfoTTL: number;
  };
  security: {
    stateExpireMinutes: number;
    signCheck: boolean;
    ipCheck: boolean;
    sessionCheck: boolean;
  };
  retry: {
    maxRetries: number;
    retryInterval: number;
  };
  domains: {
    official: string;
    open: string;
    pay: string;
  };
}

type WechatPlatformConfigs = {
  officialAccount: PlatformConfig<OfficialAccountConfig>;
  miniProgram: PlatformConfig<MiniProgramConfig>;
  openPlatform: PlatformConfig<OpenPlatformConfig>;
  wechatPay: PlatformConfig<WechatPayConfig>;
};

const defaultCallbacks = {
  official: {
    oauth: 'https://api.example.com/api/auth/wechat/official/callback',
    qr: 'https://api.example.com/api/auth/wechat/official/qr-callback'
  },
  open: {
    scan: 'https://api.example.com/api/auth/wechat/open/scan-callback'
  }
} as const;

export const wechatConfig: WechatPlatformConfigs & { common: CommonConfig } = {
  officialAccount: {
    prod: {
      appId: process.env.WECHAT_OFFICIAL_APPID ?? '',
      appSecret: process.env.WECHAT_OFFICIAL_SECRET ?? '',
      token: process.env.WECHAT_OFFICIAL_TOKEN ?? '',
      encodingAESKey: process.env.WECHAT_OFFICIAL_ENCODING_AES_KEY ?? ''
    },
    dev: {
      appId: process.env.WECHAT_OFFICIAL_DEV_APPID ?? '',
      appSecret: process.env.WECHAT_OFFICIAL_DEV_SECRET ?? '',
      token: process.env.WECHAT_OFFICIAL_DEV_TOKEN ?? '',
      encodingAESKey: process.env.WECHAT_OFFICIAL_DEV_ENCODING_AES_KEY ?? ''
    },
    callbacks: {
      oauth: process.env.WECHAT_OFFICIAL_OAUTH_CALLBACK ?? defaultCallbacks.official.oauth,
      qr: process.env.WECHAT_OFFICIAL_QR_CALLBACK ?? defaultCallbacks.official.qr
    }
  },
  miniProgram: {
    prod: {
      appId: process.env.WECHAT_MINI_APPID ?? '',
      appSecret: process.env.WECHAT_MINI_SECRET ?? ''
    },
    dev: {
      appId: process.env.WECHAT_MINI_DEV_APPID ?? '',
      appSecret: process.env.WECHAT_MINI_DEV_SECRET ?? ''
    }
  },
  openPlatform: {
    prod: {
      appId: process.env.WECHAT_OPEN_APPID ?? '',
      appSecret: process.env.WECHAT_OPEN_SECRET ?? '',
      componentAppId: process.env.WECHAT_COMPONENT_APPID ?? '',
      componentSecret: process.env.WECHAT_COMPONENT_SECRET ?? ''
    },
    dev: {
      appId: process.env.WECHAT_OPEN_DEV_APPID ?? '',
      appSecret: process.env.WECHAT_OPEN_DEV_SECRET ?? '',
      componentAppId: process.env.WECHAT_COMPONENT_DEV_APPID ?? '',
      componentSecret: process.env.WECHAT_COMPONENT_DEV_SECRET ?? ''
    },
    callbacks: {
      scan: process.env.WECHAT_OPEN_SCAN_CALLBACK ?? defaultCallbacks.open.scan
    }
  },
  wechatPay: {
    prod: {
      appId: process.env.WECHAT_APP_ID ?? '',
      mchId: process.env.WECHAT_MCH_ID ?? '',
      privateKey: process.env.WECHAT_PRIVATE_KEY ?? '',
      apiV3Key: process.env.WECHAT_API_V3_KEY ?? '',
      merchantSerialNumber: process.env.WECHAT_MERCHANT_SERIAL_NO ?? ''
    },
    dev: {
      appId: process.env.WECHAT_DEV_APP_ID ?? '',
      mchId: process.env.WECHAT_DEV_MCH_ID ?? '',
      privateKey: process.env.WECHAT_DEV_PRIVATE_KEY ?? '',
      apiV3Key: process.env.WECHAT_DEV_API_V3_KEY ?? '',
      merchantSerialNumber: process.env.WECHAT_DEV_MERCHANT_SERIAL_NO ?? ''
    }
  },
  common: {
    cache: {
      accessTokenTTL: 7_200,
      jsapiTicketTTL: 7_200,
      sessionTTL: 86_400,
      userInfoTTL: 3_600
    },
    security: {
      stateExpireMinutes: 10,
      signCheck: true,
      ipCheck: true,
      sessionCheck: true
    },
    retry: {
      maxRetries: 3,
      retryInterval: 1_000
    },
    domains: {
      official: 'https://api.weixin.qq.com',
      open: 'https://open.weixin.qq.com',
      pay: 'https://api.mch.weixin.qq.com'
    }
  }
};

type PlatformConfigWithDomains<T extends WechatPlatform> = (T extends 'officialAccount'
  ? OfficialAccountConfig
  : T extends 'miniProgram'
    ? MiniProgramConfig
    : T extends 'openPlatform'
      ? OpenPlatformConfig
      : WechatPayConfig) & {
  callbacks?: OAuthCallbacks;
  domains: CommonConfig['domains'];
};

export const getWechatConfig = <TPlatform extends WechatPlatform>(
  platform: TPlatform,
  env: WechatEnvironment | string = process.env.NODE_ENV ?? 'development'
): PlatformConfigWithDomains<TPlatform> => {
  const config = wechatConfig[platform];
  if (!config) {
    throw new Error(`不支持的微信平台: ${platform}`);
  }

  const targetEnv = env === 'production' ? 'prod' : 'dev';
  const credentials = config[targetEnv] as PlatformConfigWithDomains<TPlatform>;

  return {
    ...credentials,
    callbacks: config.callbacks,
    domains: wechatConfig.common.domains
  } as PlatformConfigWithDomains<TPlatform>;
};

export const validateWechatConfig = (
  platform: WechatPlatform,
  env: WechatEnvironment | string = process.env.NODE_ENV ?? 'development'
): true => {
  const config = getWechatConfig(platform, env);
  const errors: string[] = [];

  switch (platform) {
    case 'officialAccount':
      {
        const official = config as PlatformConfigWithDomains<'officialAccount'>;
        if (!official.appId) errors.push('微信公众号AppId缺失');
        if (!official.appSecret) errors.push('微信公众号AppSecret缺失');
      }
      break;
    case 'miniProgram':
      {
        const miniProgram = config as PlatformConfigWithDomains<'miniProgram'>;
        if (!miniProgram.appId) errors.push('微信小程序AppId缺失');
        if (!miniProgram.appSecret) errors.push('微信小程序AppSecret缺失');
      }
      break;
    case 'openPlatform':
      {
        const openPlatform = config as PlatformConfigWithDomains<'openPlatform'>;
        if (!openPlatform.appId) errors.push('微信开放平台AppId缺失');
        if (!openPlatform.appSecret) errors.push('微信开放平台AppSecret缺失');
      }
      break;
    case 'wechatPay':
      {
        const wechatPay = config as PlatformConfigWithDomains<'wechatPay'>;
        if (!wechatPay.appId) errors.push('微信支付AppId缺失');
        if (!wechatPay.mchId) errors.push('微信商户号缺失');
        if (!wechatPay.privateKey) errors.push('微信支付私钥缺失');
      }
      break;
    default:
      break;
  }

  if (errors.length > 0) {
    throw new Error(`${platform}配置不完整: ${errors.join(', ')}`);
  }

  return true;
};

export const getWechatApiUrl = (
  platform: 'officialAccount' | 'openPlatform' | 'wechatPay',
  endpoint: string,
  env: WechatEnvironment | string = process.env.NODE_ENV ?? 'development'
): string => {
  const config = getWechatConfig(platform, env);
  let domain: string;

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
};

export const generateWechatState = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).slice(2, 10);
  const state = Buffer.from(`${timestamp}_${random}`).toString('base64');
  return state.replace(/[+=]/g, '').slice(0, 32);
};

export const verifyWechatState = (state: string, maxAge = 10 * 60 * 1000): boolean => {
  try {
    const decoded = Buffer.from(`${state}==`, 'base64').toString();
    const [timestamp] = decoded.split('_');
    const timestampMs = Number.parseInt(timestamp, 10);

    if (!timestampMs || Number.isNaN(timestampMs) || Date.now() - timestampMs > maxAge) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

const wechatConfigService = {
  common: wechatConfig.common,
  getConfig: getWechatConfig,
  validateConfig: validateWechatConfig,
  getApiUrl: getWechatApiUrl,
  generateState: generateWechatState,
  verifyState: verifyWechatState
};

export default wechatConfigService;
