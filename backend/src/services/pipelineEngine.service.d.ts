declare const pipelineEngine: {
  executePipeline: (taskId: string, featureId: string, inputData: any) => Promise<any>;
};
export default pipelineEngine;
