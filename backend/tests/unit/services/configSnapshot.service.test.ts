/**
 * ConfigSnapshot Service 单元测试
 * 艹，测试配置快照的创建和回滚逻辑！
 */

import * as snapshotService from '../../../src/services/configSnapshot.service';
import db from '../../../src/db';

// Mock db
jest.mock('../../../src/db', () => {
  const mockDb: any = jest.fn(() => ({
    insert: jest.fn().mockResolvedValue([1]),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
  }));

  mockDb.fn = {
    now: jest.fn(() => new Date()),
  };

  return mockDb;
});

describe('ConfigSnapshot Service - 单元测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSnapshot', () => {
    test('应该成功创建快照', async () => {
      const input = {
        snapshot_name: '测试快照',
        description: '这是一个测试快照',
        config_type: 'provider',
        config_ref: 'test-001',
        config_data: { name: '测试配置' },
        created_by: 1,
      };

      // Mock insert返回ID
      (db as any).mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue([123]),
      });

      // Mock getSnapshotById
      (db as any).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 123,
          snapshot_name: input.snapshot_name,
          description: input.description,
          config_type: input.config_type,
          config_ref: input.config_ref,
          config_data: JSON.stringify(input.config_data),
          created_by: input.created_by,
          created_at: new Date(),
          is_rollback: false,
        }),
      });

      const snapshot = await snapshotService.createSnapshot(input);

      expect(snapshot.id).toBe(123);
      expect(snapshot.snapshot_name).toBe(input.snapshot_name);
      expect(snapshot.config_type).toBe(input.config_type);
      expect(snapshot.config_data).toEqual(input.config_data);
    });
  });

  describe('getSnapshotById', () => {
    test('应该成功获取快照', async () => {
      const mockSnapshot = {
        id: 1,
        snapshot_name: '测试快照',
        config_type: 'provider',
        config_ref: 'test-001',
        config_data: JSON.stringify({ name: '测试' }),
        created_at: new Date(),
        is_rollback: false,
      };

      (db as any).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockSnapshot),
      });

      const snapshot = await snapshotService.getSnapshotById(1);

      expect(snapshot).not.toBeNull();
      expect(snapshot?.id).toBe(1);
      expect(snapshot?.config_data).toEqual({ name: '测试' });
    });

    test('不存在的快照应该返回null', async () => {
      (db as any).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      });

      const snapshot = await snapshotService.getSnapshotById(999);

      expect(snapshot).toBeNull();
    });
  });

  describe('listSnapshots', () => {
    test('应该成功列出快照', async () => {
      const mockSnapshots = [
        {
          id: 1,
          snapshot_name: '快照1',
          config_type: 'provider',
          config_data: JSON.stringify({ data: 1 }),
          created_at: new Date(),
        },
        {
          id: 2,
          snapshot_name: '快照2',
          config_type: 'provider',
          config_data: JSON.stringify({ data: 2 }),
          created_at: new Date(),
        },
      ];

      (db as any).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockResolvedValue(mockSnapshots),
      });

      const snapshots = await snapshotService.listSnapshots({
        limit: 10,
        offset: 0,
      });

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].config_data).toEqual({ data: 1 });
      expect(snapshots[1].config_data).toEqual({ data: 2 });
    });

    test('应该支持按类型过滤', async () => {
      (db as any).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      });

      await snapshotService.listSnapshots({
        config_type: 'provider',
        limit: 10,
      });

      expect(db).toHaveBeenCalledWith('config_snapshots');
    });
  });

  describe('deleteSnapshot', () => {
    test('应该成功删除快照', async () => {
      (db as any).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockResolvedValue(1),
      });

      const result = await snapshotService.deleteSnapshot(1);

      expect(result).toBe(true);
    });

    test('删除不存在的快照应该返回false', async () => {
      (db as any).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockResolvedValue(0),
      });

      const result = await snapshotService.deleteSnapshot(999);

      expect(result).toBe(false);
    });
  });

  describe('autoSnapshotProvider', () => {
    test('应该自动创建Provider快照', async () => {
      const mockProvider = {
        provider_ref: 'test-001',
        provider_name: '测试Provider',
        endpoint_url: 'https://api.example.com',
        credentials_encrypted: 'encrypted',
        auth_type: 'api_key',
      };

      // Mock读取当前配置
      (db as any).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockProvider),
      });

      // Mock创建快照
      (db as any).mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue([1]),
      });

      // Mock getSnapshotById
      (db as any).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: 1,
          snapshot_name: `Auto: ${mockProvider.provider_name}`,
          config_type: 'provider',
          config_ref: 'test-001',
          config_data: JSON.stringify(mockProvider),
          created_at: new Date(),
        }),
      });

      await snapshotService.autoSnapshotProvider('test-001', 1);

      // 验证调用
      expect(db).toHaveBeenCalledWith('provider_endpoints');
    });

    test('Provider不存在时应该不创建快照', async () => {
      (db as any).mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      });

      await snapshotService.autoSnapshotProvider('non-existent');

      // 不应该调用insert
      expect(db).toHaveBeenCalledTimes(1);
    });
  });
});
