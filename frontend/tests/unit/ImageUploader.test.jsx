/**
 * ImageUploader组件单元测试
 * 测试图片上传功能、验证、状态管理等
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImageUploader from '@/components/ImageUploader'

// Mock COS服务
const mockCOS = {
  postObject: jest.fn(),
  deleteObject: jest.fn(),
}

jest.mock('cos-js-sdk-v5', () => ({
  COS: {
    getAuthorization: jest.fn(() => ({
      SecurityToken: 'mock-token',
      TmpSecretId: 'mock-secret-id',
      TmpSecretKey: 'mock-secret-key',
      StartTime: Date.now(),
      ExpiredTime: Date.now() + 3600,
    })),
    postObject: mockCOS.postObject,
    deleteObject: mockCOS.deleteObject,
  },
}))

describe('ImageUploader组件测试', () => {
  const mockOnUpload = jest.fn()
  const defaultProps = {
    onUpload: mockOnUpload,
    accept: 'image/*',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxCount: 1,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('基础功能测试', () => {
    test('应该正确渲染上传区域', () => {
      render(<ImageUploader {...defaultProps} />)

      expect(screen.getByText(/点击或拖拽上传图片/)).toBeInTheDocument()
      expect(screen.getByText(/支持 JPG、PNG、GIF 格式/)).toBeInTheDocument()
    })

    test('应该显示自定义提示文本', () => {
      const customProps = {
        ...defaultProps,
        tip: '自定义上传提示',
        description: '支持JPG格式图片，最大5MB'
      }

      render(<ImageUploader {...customProps} />)

      expect(screen.getByText('自定义上传提示')).toBeInTheDocument()
      expect(screen.getByText('支持JPG格式图片，最大5MB')).toBeInTheDocument()
    })
  })

  describe('文件验证测试', () => {
    test('应该拒绝非图片格式文件', async () => {
      const user = userEvent.setup()
      render(<ImageUploader {...defaultProps} />)

      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      const input = screen.getByRole('button').querySelector('input[type="file"]')

      await act(async () => {
        await user.upload(input, file)
      })

      expect(screen.getByText(/文件格式不支持/)).toBeInTheDocument()
      expect(mockOnUpload).not.toHaveBeenCalled()
    })

    test('应该拒绝超大文件', async () => {
      const user = userEvent.setup()
      render(<ImageUploader {...defaultProps} />)

      // 创建一个超过10MB的文件
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg'
      })
      const input = screen.getByRole('button').querySelector('input[type="file"]')

      await act(async () => {
        await user.upload(input, largeFile)
      })

      expect(screen.getByText(/文件大小超过限制/)).toBeInTheDocument()
      expect(mockOnUpload).not.toHaveBeenCalled()
    })

    test('应该拒绝过多文件', async () => {
      const user = userEvent.setup()
      render(<ImageUploader {...defaultProps} />)

      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' })
      ]
      const input = screen.getByRole('button').querySelector('input[type="file"]')

      await act(async () => {
        await user.upload(input, files)
      })

      expect(screen.getByText(/最多只能上传1个文件/)).toBeInTheDocument()
      expect(mockOnUpload).not.toHaveBeenCalled()
    })
  })

  describe('上传流程测试', () => {
    test('应该成功上传有效图片', async () => {
      const user = userEvent.setup()

      // Mock成功上传
      mockCOS.postObject.mockImplementation(({ onProgress, onSuccess }) => {
        onProgress({ percent: 50 })
        setTimeout(() => {
          onSuccess({
            Location: 'test-uploaded-image.jpg'
          })
        }, 100)
      })

      render(<ImageUploader {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = screen.getByRole('button').querySelector('input[type="file"]')

      await act(async () => {
        await user.upload(input, file)
      })

      // 应该显示上传进度
      await waitFor(() => {
        expect(screen.getByText('上传中... 50%')).toBeInTheDocument()
      })

      // 应该上传成功
      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith({
          url: 'https://test-uploaded-image.jpg',
          name: 'test.jpg',
          size: file.size
        })
      })
    })

    test('应该处理上传失败', async () => {
      const user = userEvent.setup()

      // Mock上传失败
      mockCOS.postObject.mockImplementation(({ onError }) => {
        setTimeout(() => {
          onError(new Error('上传失败'))
        }, 100)
      })

      render(<ImageUploader {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = screen.getByRole('button').querySelector('input[type="file"]')

      await act(async () => {
        await user.upload(input, file)
      })

      await waitFor(() => {
        expect(screen.getByText(/上传失败/)).toBeInTheDocument()
      })

      expect(mockOnUpload).not.toHaveBeenCalled()
    })

    test('应该支持上传进度显示', async () => {
      const user = userEvent.setup()

      let progressCallback
      mockCOS.postObject.mockImplementation(({ onProgress }) => {
        progressCallback = onProgress
      })

      render(<ImageUploader {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = screen.getByRole('button').querySelector('input[type="file"]')

      await act(async () => {
        await user.upload(input, file)
      })

      // 模拟进度更新
      act(() => {
        progressCallback({ percent: 25 })
      })

      expect(screen.getByText('上传中... 25%')).toBeInTheDocument()

      act(() => {
        progressCallback({ percent: 75 })
      })

      expect(screen.getByText('上传中... 75%')).toBeInTheDocument()
    })
  })

  describe('图片预览测试', () => {
    test('应该显示图片预览', async () => {
      const user = userEvent.setup()

      mockCOS.postObject.mockImplementation(({ onSuccess }) => {
        setTimeout(() => {
          onSuccess({
            Location: 'test-preview-image.jpg'
          })
        }, 100)
      })

      render(<ImageUploader {...defaultProps} showPreview />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = screen.getByRole('button').querySelector('input[type="file"]')

      await act(async () => {
        await user.upload(input, file)
      })

      await waitFor(() => {
        const preview = screen.getByAltText('test.jpg')
        expect(preview).toBeInTheDocument()
        expect(preview.src).toContain('test-preview-image.jpg')
      })
    })

    test('应该支持删除已上传图片', async () => {
      const user = userEvent.setup()

      mockCOS.postObject.mockImplementation(({ onSuccess }) => {
        setTimeout(() => {
          onSuccess({
            Location: 'test-delete-image.jpg'
          })
        }, 100)
      })

      render(<ImageUploader {...defaultProps} showPreview />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = screen.getByRole('button').querySelector('input[type="file"]')

      await act(async () => {
        await user.upload(input, file)
      })

      await waitFor(() => {
        expect(screen.getByAltText('test.jpg')).toBeInTheDocument()
      })

      // 点击删除按钮
      const deleteButton = screen.getByRole('button', { name: /删除/ })
      await act(async () => {
        await user.click(deleteButton)
      })

      // 图片应该被移除
      expect(screen.queryByAltText('test.jpg')).not.toBeInTheDocument()
    })
  })

  describe('拖拽上传测试', () => {
    test('应该支持拖拽上传', async () => {
      const user = userEvent.setup()

      mockCOS.postObject.mockImplementation(({ onSuccess }) => {
        setTimeout(() => {
          onSuccess({
            Location: 'dragged-image.jpg'
          })
        }, 100)
      })

      render(<ImageUploader {...defaultProps} />)

      const dropzone = screen.getByTestId('dropzone')

      const file = new File(['test'], 'dragged.jpg', { type: 'image/jpeg' })

      await act(async () => {
        fireEvent.dragEnter(dropzone)
        fireEvent.dragOver(dropzone)
        fireEvent.drop(dropzone, {
          dataTransfer: {
            files: [file]
          }
        })
      })

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith({
          url: 'https://dragged-image.jpg',
          name: 'dragged.jpg',
          size: file.size
        })
      })
    })

    test('拖拽时应该显示视觉反馈', async () => {
      render(<ImageUploader {...defaultProps} />)

      const dropzone = screen.getByTestId('dropzone')

      act(() => {
        fireEvent.dragEnter(dropzone)
      })

      expect(dropzone).toHaveClass('drag-active')

      act(() => {
        fireEvent.dragLeave(dropzone)
      })

      expect(dropzone).not.toHaveClass('drag-active')
    })
  })

  describe('无障碍访问测试', () => {
    test('应该有正确的ARIA标签', () => {
      render(<ImageUploader {...defaultProps} />)

      const uploadButton = screen.getByRole('button')
      expect(uploadButton).toHaveAttribute('aria-label', '上传图片')

      const input = uploadButton.querySelector('input[type="file"]')
      expect(input).toHaveAttribute('aria-label', '选择图片文件')
    })

    test('应该支持键盘操作', async () => {
      const user = userEvent.setup()
      render(<ImageUploader {...defaultProps} />)

      const uploadButton = screen.getByRole('button')

      // 使用Enter键触发上传
      await act(async () => {
        uploadButton.focus()
        await user.keyboard('{Enter}')
      })

      // 应该打开文件选择对话框
      const input = uploadButton.querySelector('input[type="file"]')
      expect(input).toBeInTheDocument()
    })
  })

  describe('错误边界测试', () => {
    test('应该优雅处理网络错误', async () => {
      const user = userEvent.setup()

      mockCOS.postObject.mockImplementation(() => {
        throw new Error('网络连接失败')
      })

      render(<ImageUploader {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = screen.getByRole('button').querySelector('input[type="file"]')

      await act(async () => {
        await user.upload(input, file)
      })

      await waitFor(() => {
        expect(screen.getByText(/网络错误/)).toBeInTheDocument()
      })

      expect(mockOnUpload).not.toHaveBeenCalled()
    })

    test('应该处理COS认证失败', async () => {
      const user = userEvent.setup()

      // Mock认证失败
      const { COS } = require('cos-js-sdk-v5')
      COS.getAuthorization.mockImplementation(() => {
        throw new Error('认证失败')
      })

      render(<ImageUploader {...defaultProps} />)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const input = screen.getByRole('button').querySelector('input[type="file"]')

      await act(async () => {
        await user.upload(input, file)
      })

      await waitFor(() => {
        expect(screen.getByText(/认证失败/)).toBeInTheDocument()
      })

      expect(mockOnUpload).not.toHaveBeenCalled()
    })
  })
})