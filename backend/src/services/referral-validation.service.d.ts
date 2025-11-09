declare const referralValidationService: {
  validateReferrerQualification: (referrerId: string, qualificationType?: string) => Promise<any>;
  validateReferralRelationship: (
    referrerId: string,
    refereeId: string,
    referralData?: any
  ) => Promise<any>;
  createReferral: (data: any) => Promise<any>;
};
export default referralValidationService;
