module.exports = {
  testEnvironment: 'node',
  // 艹，支持TypeScript和JavaScript测试文件
  preset: 'ts-jest',
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    '!src/**/*.d.ts', // 排除类型声明文件
    '!src/server.js', // 排除服务器入口文件
    '!src/config/database.js', // 排除数据库配置
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/tests/**/*.test.{js,ts}'
  ],
  // 这tm的transform配置很重要，支持TypeScript转译
  transform: {
    '^.+\.ts$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }]
  },
  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
  // 测试覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
