declare const mcpEndpointService: {
  getEndpoints: (opts: any) => Promise<any>;
  getEndpointById: (id: string) => Promise<any>;
  createEndpoint: (data: any, userId?: string) => Promise<any>;
  updateEndpoint: (id: string, data: any, userId?: string) => Promise<any>;
  deleteEndpoint: (id: string, userId?: string) => Promise<boolean>;
  testEndpoint: (
    id: string
  ) => Promise<{ success: boolean; latency?: number; toolsCount?: number }>;
  connectEndpoint: (id: string) => Promise<any>;
  disconnectEndpoint: (id: string) => Promise<any>;
  discoverTools: (id: string) => Promise<any[]>;
  executeTool: (id: string, toolName: string, args: any) => Promise<any>;
};
export default mcpEndpointService;
