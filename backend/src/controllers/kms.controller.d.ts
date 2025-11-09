declare const kmsController: {
  listKeys: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getKey: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  createKey: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  updateKey: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  deleteKey: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
};

export default kmsController;
