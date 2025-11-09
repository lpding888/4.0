declare const kmsService: {
  generateKey: (cfg: any) => Promise<any>;
  encrypt: (args: any) => Promise<any>;
  decrypt: (args: any) => Promise<any>;
  rotateKey?: (keyName: string, options?: any) => Promise<any>;
  getKeyInfo?: (keyNameOrId: string) => Promise<any[]>;
  deleteKey: (keyNameOrId: string, options?: any) => Promise<boolean>;
};
export default kmsService;
