declare const distributionService: {
  applyDistributor: (userId: string, data: any) => Promise<any>;
  getDistributorStatus: (userId: string) => Promise<any>;
  getDistributorDetail: (userId: string) => Promise<any>;
  getDashboard: (userId: string) => Promise<any>;
  getReferrals: (userId: string, options: any) => Promise<any>;
  getCommissions: (userId: string, options: any) => Promise<any>;
  getWithdrawals: (userId: string, options: any) => Promise<any>;
  createWithdrawal: (userId: string, payload: any) => Promise<string | number>;
};

export default distributionService;
