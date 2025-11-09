// 艹！在import之前Mock SDK（setup.ts已经Mock了winston和tencentcloud）
jest.mock('cos-nodejs-sdk-v5', () => {
  return jest.fn().mockImplementation(() => ({
    putObject: jest.fn(),
    getObject: jest.fn()
  }));
});

import pipelineEngine from '../../../src/services/pipelineEngine.service.js';

// 🟢 已修复：setup.ts Mock了全部SDK，现在可以正常测试
describe('PipelineEngine retry policy', () => {
  const engine = pipelineEngine as any;

  it('returns base delay when exponential disabled', () => {
    const delay = engine.calculateRetryDelay(
      { maxAttempts: 3, delayMs: 500, exponential: false },
      2
    );
    expect(delay).toBe(500);
  });

  it('applies exponential backoff when enabled', () => {
    const delay = engine.calculateRetryDelay(
      { maxAttempts: 5, delayMs: 200, exponential: true },
      3
    );
    expect(delay).toBeGreaterThan(200);
  });
});
