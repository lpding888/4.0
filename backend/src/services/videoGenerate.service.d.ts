declare const videoGenerateService: {
  processVideoTask: (
    taskId: string,
    imageUrl: string,
    params?: any
  ) => Promise<{ vendorTaskId: string; status: string }>;
  pollVideoStatus: (vendorTaskId: string) => Promise<{
    status: 'success' | 'failed' | 'pending' | 'processing';
    videoUrl?: string;
    errorMessage?: string;
  }>;
  isTimeout: (createdAt: Date) => boolean;
  getErrorMessage: (errorType: string) => string;
};
export default videoGenerateService;
