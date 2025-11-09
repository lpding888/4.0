declare const swaggerService: {
  getSpec: () => any;
  getEndpoints: () => any[];
  getEndpointsByTag: () => Record<string, any[]>;
  getSchemas: () => any[];
  validateDocs: () => any;
  regenerateDocs: () => Promise<{ stats?: Record<string, any> }>;
  getStats: () => Record<string, any>;
  setAutoUpdate: (enabled: boolean) => void;
};

export default swaggerService;
