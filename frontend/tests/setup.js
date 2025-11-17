// Jest 测试环境配置
import '@testing-library/jest-dom'
import { ReadableStream } from 'stream/web'
import { TextEncoder, TextDecoder } from 'util'

if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream
}

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder
}

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: '',
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock Next.js image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => <img {...props} />,
}))

// Mock COS SDK
jest.mock('cos-js-sdk-v5', () => ({
  COS: {
    getAuthorization: jest.fn(() => ({
      SecurityToken: 'mock-token',
      TmpSecretId: 'mock-secret-id',
      TmpSecretKey: 'mock-secret-key',
      StartTime: Date.now(),
      ExpiredTime: Date.now() + 3600,
    })),
    postObject: jest.fn(),
    deleteObject: jest.fn(),
  },
}))

// Mock API请求
global.fetch = jest.fn()

// 清理函数
afterEach(() => {
  jest.clearAllMocks()
})

// 控制台输出设置
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }
}
