declare const imageProcessService: {
  processBasicClean: (taskId: string, inputImageUrl: string, params?: any) => Promise<void>;
};
export default imageProcessService;
