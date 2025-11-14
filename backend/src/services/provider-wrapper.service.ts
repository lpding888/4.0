import logger from '../utils/logger.js';
import circuitBreakerService from './circuit-breaker.service.js';
import cacheService from './cache.service.js';

type Provider = Record<string, unknown>;

interface ProviderConfig {
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
    halfOpenMaxCalls: number;
    successThreshold: number;
  };
  retry: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoff: 'exponential' | 'fixed' | 'linear';
  };
  timeout: number;
  cache: {
    ttl: number;
    enabled: boolean;
  };
}

interface CircuitBreakerState {
  getState?: () => string;
}

interface ProviderExecuteOptions {
  [key: string]: unknown;
}

interface ProviderStats {
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  totalTimeouts: number;
  totalCaches: number;
  averageResponseTime: number;
  totalResponseTime: number;
  lastRequestTime: null | number;
  lastSuccessTime: null | number;
  lastFailureTime: null | number;
  circuitBreaker?: unknown;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  providers?: Record<string, unknown>;
  totalProviders?: number;
  activeProviders?: number;
  timestamp: string;
  error?: string;
}

class ProviderWrapper {
  constructor(
    public readonly name: string,
    public readonly provider: Provider,
    public readonly config: ProviderConfig,
    public readonly circuitBreaker: CircuitBreakerState
  ) {}

  private stats = {
    totalRequests: 0,
    totalSuccesses: 0,
    totalFailures: 0,
    totalTimeouts: 0,
    totalCaches: 0,
    averageResponseTime: 0,
    totalResponseTime: 0,
    lastRequestTime: null as null | number,
    lastSuccessTime: null as null | number,
    lastFailureTime: null as null | number
  };

  getStats() {
    return { ...this.stats, circuitBreaker: this.circuitBreaker.getState?.() };
  }

  resetStats() {
    this.stats = {
      ...this.stats,
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalTimeouts: 0,
      totalCaches: 0,
      averageResponseTime: 0,
      totalResponseTime: 0
    };
  }

  getState() {
    return { circuitBreaker: this.circuitBreaker, stats: this.getStats() };
  }

  async execute(
    methodName: string,
    args: unknown[] = [],
    _options: ProviderExecuteOptions = {}
  ): Promise<unknown> {
    const opName = `provider:${this.name}:${methodName}`;
    const doCall = async () => {
      const start = Date.now();
      this.stats.totalRequests++;
      this.stats.lastRequestTime = start;
      try {
        const fn = this.provider?.[methodName];
        if (typeof fn !== 'function')
          throw new Error(`Provider方法不存在: ${this.name}.${methodName}`);
        const result = await fn.apply(this.provider, args);
        const dur = Date.now() - start;
        this.stats.totalSuccesses++;
        this.stats.totalResponseTime += dur;
        this.stats.averageResponseTime =
          this.stats.totalResponseTime / Math.max(1, this.stats.totalRequests);
        this.stats.lastSuccessTime = Date.now();
        return result;
      } catch (err: unknown) {
        this.stats.totalFailures++;
        this.stats.lastFailureTime = Date.now();
        throw err;
      }
    };

    const fallback = async (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.warn(`[ProviderWrapper] 执行降级: ${opName}`, { error: err.message });
      throw error; // 先不提供真正的降级实现
    };

    return await circuitBreakerService.execute(
      opName,
      doCall,
      fallback,
      this.config.circuitBreaker
    );
  }
}

class ProviderWrapperService {
  private providers = new Map<string, Provider>();
  private wrappers = new Map<string, ProviderWrapper>();

  private readonly defaultConfig: ProviderConfig = {
    circuitBreaker: {
      failureThreshold: 3,
      resetTimeout: 30000,
      monitoringPeriod: 10000,
      halfOpenMaxCalls: 2,
      successThreshold: 2
    },
    retry: { maxAttempts: 2, baseDelay: 1000, maxDelay: 10000, backoff: 'exponential' },
    timeout: 30000,
    cache: { ttl: 300, enabled: true }
  };

  registerProvider(name: string, provider: Provider, config: Partial<ProviderConfig> = {}) {
    const fullConfig: ProviderConfig = {
      ...this.defaultConfig,
      ...config,
      circuitBreaker: { ...this.defaultConfig.circuitBreaker, ...(config.circuitBreaker || {}) },
      retry: { ...this.defaultConfig.retry, ...(config.retry || {}) },
      cache: { ...this.defaultConfig.cache, ...(config.cache || {}) }
    } as ProviderConfig;

    const circuitBreaker = circuitBreakerService.getCircuitBreaker(
      `provider_${name}`,
      fullConfig.circuitBreaker
    );
    const wrapper = new ProviderWrapper(name, provider, fullConfig, circuitBreaker);
    this.providers.set(name, provider);
    this.wrappers.set(name, wrapper);
    logger.info(`[ProviderWrapper] Provider注册成功: ${name}`);
  }

  getWrapper(name: string): ProviderWrapper | null {
    return this.wrappers.get(name) || null;
  }

  getProvider(name: string): Provider | null {
    return this.providers.get(name) || null;
  }

  async execute(
    providerName: string,
    methodName: string,
    args: unknown[] = [],
    options: ProviderExecuteOptions = {}
  ): Promise<unknown> {
    const wrapper = this.getWrapper(providerName);
    if (!wrapper) throw new Error(`Provider不存在: ${providerName}`);
    return await wrapper.execute(methodName, args, options);
  }

  getAllProviderStates(): Omit<HealthCheckResponse, 'status' | 'error'> & {
    providers: Record<string, unknown>;
  } {
    const states: Record<string, unknown> = {};
    for (const [name, wrapper] of this.wrappers) {
      states[name] = wrapper.getState();
    }
    return {
      providers: states,
      totalProviders: this.wrappers.size,
      activeProviders: Array.from(this.wrappers.values()).filter(
        (w) => w.circuitBreaker?.getState?.() !== 'open'
      ).length,
      timestamp: new Date().toISOString()
    };
  }

  getProviderStats(providerName: string) {
    return this.getWrapper(providerName)?.getStats() ?? null;
  }

  resetProviderStats(providerName: string) {
    const wrapper = this.getWrapper(providerName);
    if (!wrapper) return false;
    wrapper.resetStats();
    logger.info(`[ProviderWrapper] Provider统计已重置: ${providerName}`);
    return true;
  }

  async healthCheck(): Promise<HealthCheckResponse> {
    try {
      const states = this.getAllProviderStates();
      const activeProviders = states.activeProviders ?? 0;
      return {
        status: activeProviders > 0 ? 'healthy' : 'degraded',
        ...states
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[ProviderWrapper] 健康检查失败', err);
      return { status: 'unhealthy', error: err.message, timestamp: new Date().toISOString() };
    }
  }
}

const providerWrapperService = new ProviderWrapperService();
export default providerWrapperService;
