export type WechatOAuthUrlResult = {
  authUrl: string;
  state: string;
};

export type WechatLoginResult = Record<string, unknown>;

declare const wechatLoginService: {
  generateOfficialOAuthUrl(
    redirectUri: string,
    scope?: string,
    state?: string | null
  ): WechatOAuthUrlResult;
  handleOfficialOAuthCallback(code: string, state: string): Promise<WechatLoginResult>;
  handleMiniProgramLogin(
    code: string,
    userInfo?: Record<string, unknown>
  ): Promise<WechatLoginResult>;
  generateOpenPlatformOAuthUrl(redirectUri: string, state?: string | null): WechatOAuthUrlResult;
  handleOpenPlatformCallback(code: string, state: string): Promise<WechatLoginResult>;
  getUserWechatBindings(userId: string): Promise<Record<string, unknown>>;
  unbindWechat(userId: string): Promise<boolean>;
  getStats(): Record<string, unknown>;
};

export default wechatLoginService;
