declare const userProfileController: {
  getUserFullProfile: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getUserBasicInfo: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  updateUserBasicInfo: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getUserEducation: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  addEducation: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  updateEducation: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  deleteEducation: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getUserWorkExperience: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  addWorkExperience: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  updateWorkExperience: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  deleteWorkExperience: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getUserSkills: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  addSkill: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  updateSkill: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  deleteSkill: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getUserInterests: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getUserSocialLinks: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getUserProfileCompleteness: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  recalculateProfileCompleteness: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  getProfileSuggestions: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  batchUpdateProfile: (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  uploadAvatar: (
    req: import('express').Request & { file?: Express.Multer.File },
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
  uploadBanner: (
    req: import('express').Request & { file?: Express.Multer.File },
    res: import('express').Response,
    next: import('express').NextFunction
  ) => any;
};

export default userProfileController;
