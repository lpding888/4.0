declare const hunyuanService: {
  generateShootingScript: (imageUrl: string, params?: Record<string, unknown>) => Promise<string>;
  validateScript: (script: string) => boolean;
};

export default hunyuanService;
