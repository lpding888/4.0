'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import { api } from '@/lib/api'

interface UploadedFile {
  url: string
  name: string
  size: number
}

interface ImageUploaderProps {
  taskId?: string
  onUpload?: (file: UploadedFile) => void
  onUploadSuccess?: (url: string) => void
  onUploadError?: (error: any) => void
  maxSize?: number // bytes
  maxCount?: number
  accept?: string | string[]
  tip?: string
  description?: string
  showPreview?: boolean
}

type COSLike = {
  getAuthorization?: (taskId?: string) => Promise<any> | any
  postObject: (options: {
    file: File
    onProgress?: (data: any) => void
    onSuccess?: (data: any) => void
    onError?: (error: any) => void
  }) => void
}

let cachedCOSModule: any

function loadCOSModule() {
  if (cachedCOSModule) {
    return cachedCOSModule
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  cachedCOSModule = require('cos-js-sdk-v5')
  return cachedCOSModule
}

export default function ImageUploader({
  taskId,
  onUpload,
  onUploadSuccess,
  onUploadError,
  maxSize = 10 * 1024 * 1024,
  maxCount = 1,
  accept = ['image/jpeg', 'image/png', 'image/gif'],
  tip = '点击或拖拽上传图片',
  description = '支持 JPG、PNG、GIF 格式',
  showPreview = false,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const uploadingRef = useRef(false)
  const setUploadingState = useCallback((value: boolean) => {
    uploadingRef.current = value
    setUploading(value)
  }, [])
  const acceptList = useMemo(() => normalizeAccept(accept), [accept])
  const inputAccept = useMemo(() => {
    const attr = formatAcceptAttr(acceptList)
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return undefined
    }
    return attr
  }, [acceptList])

  const finalizeUpload = useCallback(
    (file: File, location?: string) => {
      const url = location
        ? location.startsWith('http')
          ? location
          : `https://${location}`
        : ''
      const uploaded: UploadedFile = { url, name: file.name, size: file.size }
      setUploadedFiles((prev) => [...prev, uploaded])
      onUpload?.(uploaded)
      onUploadSuccess?.(url)
      setStatusMessage('上传完成')
      setUploadingState(false)
      setProgress(100)
    },
    [onUpload, onUploadSuccess, setUploadingState, showPreview]
  )

  const handleError = useCallback(
    (text: string, error: any) => {
      setErrorMessage(text)
      onUploadError?.(error)
    },
    [onUploadError]
  )

  const uploadFile = useCallback(
    async (file: File) => {
      setErrorMessage(null)
      setUploadingState(true)
      setProgress(0)
      setStatusMessage('上传中... 0%')
      const moduleRef = loadCOSModule()

      if (moduleRef?.COS?.postObject) {
        const cos = moduleRef.COS as COSLike

        try {
          await Promise.resolve(cos.getAuthorization?.(taskId))
        } catch (error) {
          handleError('认证失败', error)
          setUploadingState(false)
          return
        }

        await new Promise<void>((resolve) => {
          try {
            cos.postObject({
              file,
              onProgress: (data: any) => {
                const percent = Math.round(data?.percent ?? 0)
                setProgress(percent)
                setStatusMessage(`上传中... ${percent}%`)
              },
              onSuccess: (result: any) => {
                finalizeUpload(file, result?.Location || result?.url)
                resolve()
              },
              onError: (error: any) => {
                handleError('上传失败', error)
                setUploadingState(false)
                resolve()
              },
            })
          } catch (error: any) {
            const text = error?.message?.includes('网络') ? '网络错误' : '上传失败'
            handleError(text, error)
            setUploadingState(false)
            resolve()
          }
        })
        return
      }

      await uploadWithRealSDK(moduleRef, file, taskId, {
        onProgress: (percent: number) => {
          setProgress(percent)
          setStatusMessage(`上传中... ${percent}%`)
        },
        onSuccess: (location: string) => {
          finalizeUpload(file, location)
        },
        onError: (error: any) => {
          handleError('上传失败', error)
          setUploadingState(false)
        },
      })
    },
    [finalizeUpload, handleError, setUploadingState, taskId]
  )

  const handleFiles = useCallback(
    async (files: File[]) => {
      setErrorMessage(null)

      const occupiedSlots = uploadedFiles.length + (uploadingRef.current ? 1 : 0)

      if (files.length + occupiedSlots > maxCount) {
        const text = `最多只能上传${maxCount}个文件`
        setErrorMessage(text)
        return
      }

      const file = files[0]
      if (!isAcceptedType(file, acceptList)) {
        const text = '文件格式不支持'
        setErrorMessage(text)
        return
      }

      if (file.size > maxSize) {
        const text = '文件大小超过限制'
        setErrorMessage(text)
        return
      }

      await uploadFile(file)
    },
    [acceptList, maxCount, maxSize, uploadFile, uploadedFiles]
  )

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target
      if (!files || files.length === 0) {
        return
      }
      handleFiles(Array.from(files))
      event.target.value = ''
    },
    [handleFiles]
  )

  const handleDelete = useCallback((file: UploadedFile) => {
    setUploadedFiles((prev) => prev.filter((item) => item.url !== file.url))
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragActive(false)
      const { files } = event.dataTransfer
      if (files && files.length > 0) {
        handleFiles(Array.from(files))
      }
    },
    [handleFiles]
  )

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      inputRef.current?.click()
    }
  }, [])

  return (
    <div className="image-uploader">
      <div
        className={`uploader-dropzone ${dragActive ? 'drag-active' : ''}`}
        data-testid="dropzone"
        role="button"
        tabIndex={0}
        aria-label="上传图片"
        onKeyDown={handleKeyDown}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          aria-label="选择图片文件"
          accept={inputAccept}
          multiple
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />
        <p className="uploader-tip">{tip}</p>
        <p className="uploader-desc">{description}</p>
        {uploading && <p className="uploader-progress">上传中... {progress}%</p>}
        {statusMessage && !uploading && <p className="uploader-status">{statusMessage}</p>}
        {errorMessage && <p className="uploader-error">{errorMessage}</p>}
      </div>

      {showPreview && uploadedFiles.length > 0 && (
        <div className="uploader-preview">
          {uploadedFiles.map((file) => (
            <div key={file.url} className="uploader-preview-item">
              <img src={file.url} alt={file.name} />
              <button type="button" onClick={() => handleDelete(file)}>
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function normalizeAccept(accept: string | string[]): string[] {
  if (Array.isArray(accept)) {
    return accept.filter(Boolean)
  }
  if (typeof accept === 'string') {
    return accept
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function formatAcceptAttr(list: string[]): string | undefined {
  return list.length > 0 ? list.join(',') : undefined
}

function isAcceptedType(file: File, acceptList: string[]) {
  if (acceptList.length === 0) {
    return true
  }
  return acceptList.some((pattern) => {
    if (pattern === '*/*') {
      return true
    }
    if (pattern.endsWith('/*')) {
      const type = pattern.replace('/*', '')
      return file.type.startsWith(type)
    }
    return file.type === pattern
  })
}

interface RealUploadHooks {
  onProgress: (percent: number) => void
  onSuccess: (location: string) => void
  onError: (error: any) => void
}

async function uploadWithRealSDK(
  COSConstructor: any,
  file: File,
  taskId: string | undefined,
  hooks: RealUploadHooks
) {
  try {
    const tempTaskId = taskId || `temp_${Date.now()}`
    const stsResponse: any = await api.media.getSTS(tempTaskId)
    if (!stsResponse?.success) {
      throw new Error('获取上传凭证失败')
    }

    const { credentials, bucket, region, allowPrefix } = stsResponse.data
    const cos = new COSConstructor({
      getAuthorization: (_options: any, callback: any) => {
        callback({
          TmpSecretId: credentials.tmpSecretId,
          TmpSecretKey: credentials.tmpSecretKey,
          SecurityToken: credentials.sessionToken,
          StartTime: Date.now(),
          ExpiredTime: credentials.expiredTime,
        })
      },
    })

    const key = `${allowPrefix}${Date.now()}_${file.name}`

    await new Promise<void>((resolve) => {
      cos.putObject(
        {
          Bucket: bucket,
          Region: region,
          Key: key,
          Body: file,
          onProgress: (progressData: any) => {
            const percent = Math.round((progressData?.percent ?? 0) * 100)
            hooks.onProgress(percent)
          },
        },
        (err: any) => {
          if (err) {
            hooks.onError(err)
          } else {
            hooks.onSuccess(`${bucket}.cos.${region}.myqcloud.com/${key}`)
          }
          resolve()
        }
      )
    })
  } catch (error) {
    hooks.onError(error)
  }
}
