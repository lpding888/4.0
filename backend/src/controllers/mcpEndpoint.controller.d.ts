declare const mcpEndpointController: {
  getEndpoints: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getEndpointStats: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getServerTypes: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getTemplates: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  batchTestEndpoints: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  healthCheck: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getEndpointById: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  testEndpoint: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  connectEndpoint: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  disconnectEndpoint: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  discoverTools: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  executeTool: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  createEndpoint: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  updateEndpoint: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  deleteEndpoint: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
};

export default mcpEndpointController;
