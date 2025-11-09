declare const cacheSubscriberService: {
  getStatus: () => any;
  invalidateCache: (namespace: string, pattern: string, reason: string) => Promise<void>;
  updateVersion: (namespace: string) => Promise<string | number>;
  triggerPreload: (namespace: string, items: any[], priority?: string) => Promise<void>;
  broadcastHealthCheck: () => Promise<void>;
  start: () => Promise<void> | void;
  stop: () => Promise<void> | void;
};

export default cacheSubscriberService;
