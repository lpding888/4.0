'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Button,
  Spin,
  message,
  Image,
  Modal
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Task } from '@/types';
import VideoPlayer from '@/components/VideoPlayer';

// 轮询配置常量（艹，必须固化！）
const POLLING_CONFIG = {
  INITIAL_INTERVAL: 3000,           // 初始间隔 3s
  BACKOFF_MAX: 20000,               // 退避上限 20s
  SLOW_DOWN_AFTER: 5 * 60 * 1000,   // 5分钟后降频
  MAX_POLLING_DURATION: 15 * 60 * 1000  // 最长轮询15分钟
};

/**
 * 任务详情页 - 支持多种 output_type
 *
 * 艹，这个页面必须支持所有类型的任务输出！
 * 遵循青蓝玻璃拟态主题！
 */
export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params?.taskId as string;
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(POLLING_CONFIG.INITIAL_INTERVAL);

  const pollingStartTime = useRef<number>(0);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 计算下一个轮询间隔（指数退避）
  const calculateNextInterval = (currentInterval: number, elapsedTime: number): number => {
    // 超过5分钟，固定使用20s间隔
    if (elapsedTime > POLLING_CONFIG.SLOW_DOWN_AFTER) {
      return POLLING_CONFIG.BACKOFF_MAX;
    }

    // 指数退避: 3s → 6s → 12s → 20s(上限)
    const nextInterval = Math.min(currentInterval * 2, POLLING_CONFIG.BACKOFF_MAX);
    return nextInterval;
  };

  // 获取任务详情
  const fetchTaskDetail = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const response: any = await api.task.get(taskId);

      if (response.success && response.data) {
        setTask(response.data);

        // 如果任务还在处理中，开始轮询
        if (response.data.status === 'processing' || response.data.status === 'pending') {
          if (!polling) {
            setPolling(true);
            pollingStartTime.current = Date.now();
          }
        } else {
          // 任务完成或失败，停止轮询
          setPolling(false);
        }
      }
    } catch (error: any) {
      message.error(error.message || '获取任务详情失败');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // 初始加载
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (taskId) {
      fetchTaskDetail();
    }
  }, [user, taskId, router]);

  // 轮询逻辑（指数退避策略）
  useEffect(() => {
    if (!polling) {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const elapsedTime = Date.now() - pollingStartTime.current;

      // 超过最长轮询时长，停止轮询
      if (elapsedTime > POLLING_CONFIG.MAX_POLLING_DURATION) {
        setPolling(false);
        message.warning('轮询超时，请刷新页面查看最新状态');
        return;
      }

      // 获取任务详情
      await fetchTaskDetail(false);

      // 计算下一个间隔
      const nextInterval = calculateNextInterval(pollingInterval, elapsedTime);
      setPollingInterval(nextInterval);

      // 设置下一次轮询
      pollingTimerRef.current = setTimeout(poll, nextInterval);
    };

    // 启动轮询
    pollingTimerRef.current = setTimeout(poll, pollingInterval);

    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [polling, pollingInterval, taskId]);

  // 下载文件
  const handleDownload = (url: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `download_${Date.now()}`;
    link.click();
    message.success('开始下载');
  };

  // 保存到素材库（如果后端已自动保存，此按钮不显示）
  const handleSaveToLibrary = async () => {
    // TODO: 调用后端接口保存到素材库
    message.success('已保存到素材库');
  };

  // 再生成一次（跳转回创建页面）
  const handleRetry = () => {
    if (!task || !task.feature_id) {
      message.error('无法重新生成');
      return;
    }

    // 跳转到创建页面，预填表单数据
    router.push(`/task/create/${task.feature_id}`);
  };

  // 渲染不同类型的输出内容
  const renderOutput = () => {
    if (!task || task.status !== 'success') {
      return null;
    }

    const outputType = task.output_type || 'multiImage'; // 默认多图

    switch (outputType) {
      case 'singleImage':
        // 单张大图展示
        return (
          <div className="flex justify-center">
            <Image
              src={task.resultUrls?.[0]}
              alt="处理结果"
              className="rounded-lg max-w-full"
              style={{ maxHeight: '600px' }}
            />
          </div>
        );

      case 'multiImage':
        // 九宫格展示
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {task.resultUrls?.map((url, index) => (
              <div key={index} className="relative group">
                <Image
                  src={url}
                  alt={`结果${index + 1}`}
                  className="rounded-lg w-full"
                  style={{ objectFit: 'cover', height: '250px' }}
                />
                <button
                  onClick={() => handleDownload(url, `result_${index + 1}.png`)}
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100
                    bg-cyan-500/80 hover:bg-cyan-500
                    text-white rounded-lg px-3 py-1
                    transition-all duration-300"
                >
                  <DownloadOutlined className="mr-1" />
                  下载
                </button>
              </div>
            ))}
          </div>
        );

      case 'video':
        // 视频播放器
        return (
          <div className="space-y-4">
            {task.resultVideoUrl && (
              <VideoPlayer
                videoUrl={task.resultVideoUrl}
                posterUrl={task.inputUrl}
                width={800}
                height={450}
                onDownload={(url) => handleDownload(url, 'video.mp4')}
              />
            )}
            {task.resultVideoUrls && task.resultVideoUrls.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {task.resultVideoUrls.map((videoUrl, index) => (
                  <div key={index}>
                    <p className="text-white/60 text-sm mb-2">版本 {index + 1}</p>
                    <VideoPlayer
                      videoUrl={videoUrl}
                      posterUrl={task.inputUrl}
                      width={400}
                      height={250}
                      onDownload={(url) => handleDownload(url, `video_${index + 1}.mp4`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'zip':
        // ZIP 下载按钮
        return (
          <div className="text-center py-12">
            <p className="text-white/80 mb-6">生成的文件已打包完成</p>
            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(task.resultUrls?.[0] || '', 'result.zip')}
              className="border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-400/30"
            >
              下载压缩包
            </Button>
          </div>
        );

      case 'textBundle':
        // 文本内容展示
        return (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-6">
            <pre className="text-white/80 whitespace-pre-wrap font-mono text-sm">
              {task.artifacts?.[0]?.metadata?.content || '文本内容'}
            </pre>
          </div>
        );

      default:
        return <p className="text-white/60 text-center">未知的输出类型</p>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 text-center">
          <p className="text-white mb-4">任务不存在或已被删除</p>
          <Button
            onClick={() => router.push('/workspace')}
            className="border-white/20 text-white hover:bg-white/10"
          >
            返回工作台
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* 返回按钮 */}
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
          className="mb-6 border-white/20 text-white hover:bg-white/10"
        >
          返回
        </Button>

        {/* 任务信息卡片 */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-6 mb-6">
          {/* 状态标题 */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-light text-white">任务详情</h1>
            <div>
              {task.status === 'processing' && (
                <div className="flex items-center bg-teal-500/20 border border-teal-400/50 text-teal-300 px-4 py-2 rounded-full animate-pulse">
                  <div className="w-2 h-2 bg-teal-400 rounded-full mr-2 animate-ping" />
                  生成中...
                </div>
              )}
              {task.status === 'success' && (
                <div className="flex items-center bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 px-4 py-2 rounded-full">
                  <CheckCircleOutlined className="mr-2" />
                  生成成功
                </div>
              )}
              {task.status === 'failed' && (
                <div className="flex items-center bg-rose-500/20 border border-rose-400/50 text-rose-300 px-4 py-2 rounded-full">
                  <CloseCircleOutlined className="mr-2" />
                  生成失败
                </div>
              )}
            </div>
          </div>

          {/* 任务元信息 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-white/60 mb-1">创建时间</p>
              <p className="text-white/90">{new Date(task.createdAt).toLocaleString('zh-CN')}</p>
            </div>
            {task.completedAt && (
              <div>
                <p className="text-white/60 mb-1">完成时间</p>
                <p className="text-white/90">{new Date(task.completedAt).toLocaleString('zh-CN')}</p>
              </div>
            )}
            {task.quota_cost !== undefined && (
              <div>
                <p className="text-white/60 mb-1">消耗配额</p>
                <p className="text-cyan-300 font-medium">{task.quota_cost} 次</p>
              </div>
            )}
          </div>
        </div>

        {/* 处理中状态 */}
        {(task.status === 'processing' || task.status === 'pending') && (
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-12 text-center">
            <Spin size="large" />
            <h3 className="text-xl font-light text-white mt-6 mb-2">AI 正在生成中...</h3>
            <p className="text-white/60">请稍候，这可能需要几分钟时间</p>
          </div>
        )}

        {/* 成功状态 - 展示结果 */}
        {task.status === 'success' && (
          <>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-6 mb-6">
              <h2 className="text-xl font-light text-white mb-4">生成结果</h2>
              {renderOutput()}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-4 justify-center">
              <Button
                size="large"
                icon={<DownloadOutlined />}
                onClick={() => {
                  if (task.resultUrls && task.resultUrls.length > 0) {
                    task.resultUrls.forEach((url, i) => {
                      setTimeout(() => handleDownload(url, `result_${i + 1}`), i * 500);
                    });
                  }
                }}
                className="border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-400/30"
              >
                下载结果
              </Button>
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={handleRetry}
                className="border border-teal-400/50 bg-teal-500/20 text-teal-300 hover:bg-teal-400/30"
              >
                再生成一次
              </Button>
            </div>
          </>
        )}

        {/* 失败状态 */}
        {task.status === 'failed' && (
          <div className="bg-white/10 backdrop-blur-md border border-rose-400/20 rounded-2xl shadow-xl p-12 text-center">
            <CloseCircleOutlined className="text-6xl text-rose-400 mb-4" />
            <h3 className="text-xl font-light text-white mb-2">生成失败，配额已自动返还</h3>
            <p className="text-white/60 mb-6">
              {task.error_message || task.errorReason || '处理失败，请重试'}
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => router.push('/workspace')}
                className="border-white/20 text-white hover:bg-white/10"
              >
                返回工作台
              </Button>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleRetry}
                className="border border-cyan-400/50 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-400/30"
              >
                重新生成
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
