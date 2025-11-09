declare const providerWrapperService: {
  getAllProviderStates: () => any;
  getProviderStats: (name: string) => any;
  resetProviderStats: (name: string) => boolean;
  healthCheck: () => Promise<{ status: string } & Record<string, any>>;
};

export default providerWrapperService;
