declare const aiModelService: {
  createModelTask: (taskId: string, inputImageUrl: string, params?: any) => Promise<void>;
};
export default aiModelService;
