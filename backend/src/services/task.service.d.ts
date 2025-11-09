declare const taskService: {
  createByFeature: (userId: string, featureId: string, inputData: any) => Promise<any>;
  create: (userId: string, type: string, inputImageUrl: string, params?: any) => Promise<any>;
  get: (taskId: string) => Promise<any>;
  list: (userId: string, query: any) => Promise<any>;
  updateStatus: (taskId: string, status: string, payload: any) => Promise<void>;
};
export default taskService;
