/**
 * Jest配置 - 单元测试专用
 * 艹，这个配置不加载setup.js，适用于不需要数据库的纯单元测试！
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/unit/**/*.test.js'
  ],
  // 不加载setup.js（单元测试不需要数据库）
  // setupFilesAfterEnv: [],
  testTimeout: 10000,
  verbose: true,
  // 支持TypeScript
  preset: 'ts-jest/presets/js-with-ts',
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true,
      tsconfig: {
        allowJs: true,
        esModuleInterop: true,
      }
    }],
  },
  moduleFileExtensions: ['js', 'ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/server.js',
    '!src/config/database.js',
    '!**/node_modules/**'
  ],
  // 单元测试覆盖率要求更高！
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
