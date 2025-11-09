declare const controller: {
  validateReferral: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getReferralStats: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
};
export default controller;
