'use client';

import { io, Socket } from 'socket.io-client';

type TaskUpdatePayload = {
  taskId: string;
  status: 'pending' | 'running' | 'failed' | 'completed';
  resultUrls?: string[];
  error_msg?: string;
};

type OrderPaidPayload = {
  orderId: string;
  channel: 'wx' | 'alipay';
};

class RealtimeClient {
  private socket: Socket | null = null;
  private userId: string | null = null;

  connect(userId: string, token?: string | null) {
    if (!userId) return;
    if (this.socket?.connected && this.userId === userId) {
      return;
    }

    this.userId = userId;
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL || '', {
      path: '/ws',
      transports: ['websocket'],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.socket?.emit('join', userId);
    });
  }

  onTaskUpdated(handler: (payload: TaskUpdatePayload) => void) {
    this.socket?.on('task:updated', handler);
  }

  offTaskUpdated(handler: (payload: TaskUpdatePayload) => void) {
    this.socket?.off('task:updated', handler);
  }

  onOrderPaid(handler: (payload: OrderPaidPayload) => void) {
    this.socket?.on('order:paid', handler);
  }

  offOrderPaid(handler: (payload: OrderPaidPayload) => void) {
    this.socket?.off('order:paid', handler);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
    }
  }
}

export const realtime = new RealtimeClient();
