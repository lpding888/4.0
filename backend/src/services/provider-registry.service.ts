import logger from '../utils/logger.js';
import providerWrapperService, { type HealthCheckResponse } from './provider-wrapper.service.js';
import imageProcessService from './imageProcess.service.js';
import aiModelService from './aiModel.service.js';

type ProviderConfig = Parameters<typeof providerWrapperService.registerProvider>[2];

interface ProviderInstance {
  [key: string]: unknown;
}

class ProviderRegistryService {
  private registeredProviders = new Map<string, ProviderInstance>();
  private providerConfigs = new Map<string, ProviderConfig>();
  private initialized = false;

  async initialize() {
    if (this.initialized) {
      logger.warn('[ProviderRegistry] 已初始化，跳过');
      return;
    }
    logger.info('[ProviderRegistry] 开始注册Provider...');
    await this.registerBuiltinProviders();
    await this.registerExternalProviders();
    this.initialized = true;
    logger.info(`[ProviderRegistry] Provider注册完成，共 ${this.registeredProviders.size} 个`);
  }

  private async registerBuiltinProviders() {
    this.registerProvider('imageProcess', imageProcessService as unknown as ProviderInstance, {
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 30000,
        monitoringPeriod: 10000,
        halfOpenMaxCalls: 2,
        successThreshold: 2
      },
      retry: { maxAttempts: 2, baseDelay: 1000, maxDelay: 8000, backoff: 'exponential' },
      timeout: 60000,
      cache: { ttl: 300, enabled: true }
    });
    this.registerProvider('aiModel', aiModelService as unknown as ProviderInstance, {
      circuitBreaker: {
        failureThreshold: 2,
        resetTimeout: 60000,
        monitoringPeriod: 15000,
        halfOpenMaxCalls: 1,
        successThreshold: 1
      },
      retry: { maxAttempts: 1, baseDelay: 2000, maxDelay: 5000, backoff: 'linear' },
      timeout: 120000,
      cache: { ttl: 600, enabled: true }
    });
  }

  private async registerExternalProviders() {
    // 预留：可以在此读取数据库/配置注册更多 Provider
  }

  registerProvider(name: string, provider: ProviderInstance, config: ProviderConfig = {}) {
    providerWrapperService.registerProvider(name, provider, config);
    this.registeredProviders.set(name, provider);
    this.providerConfigs.set(name, config);
  }

  getRegisteredProviders() {
    return Array.from(this.registeredProviders.keys());
  }

  isProviderRegistered(name: string): boolean {
    return this.registeredProviders.has(name);
  }

  getAllProviderStates() {
    return providerWrapperService.getAllProviderStates();
  }

  async execute(
    providerName: string,
    methodName: string,
    args: unknown[] = [],
    options: Record<string, unknown> = {}
  ) {
    return await providerWrapperService.execute(providerName, methodName, args, options);
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    const wrapperHealth = await providerWrapperService.healthCheck();
    return wrapperHealth;
  }
}

const providerRegistryService = new ProviderRegistryService();
export default providerRegistryService;
