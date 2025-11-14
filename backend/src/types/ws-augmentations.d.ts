import 'ws';

declare module 'ws' {
  interface WebSocket {
    isAlive?: boolean;
    connectionId?: string;
    ip?: string | null;
    userAgent?: string;
    connectedAt?: number;
    lastPing?: number;
    authTimeout?: NodeJS.Timeout | null;
  }
}
