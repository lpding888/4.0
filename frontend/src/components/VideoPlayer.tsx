'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Space, Select, message, Dropdown, Spin } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  DownloadOutlined,
  SettingOutlined,
  FullscreenOutlined,
  SoundOutlined,
  MutedOutlined
} from '@ant-design/icons';

interface VideoPlayerProps {
  videoUrl: string;
  posterUrl?: string;
  width?: number;
  height?: number;
  onDownload?: (url: string) => void;
  showDownload?: boolean;
}

interface QualityOption {
  label: string;
  value: string;
  url: string;
}

export default function VideoPlayer({
  videoUrl,
  posterUrl,
  width = 800,
  height = 450,
  onDownload,
  showDownload = true
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [qualities, setQualities] = useState<QualityOption[]>([
    { label: '自动', value: 'auto', url: videoUrl },
    { label: '1080p', value: '1080p', url: videoUrl.replace('video', 'video_1080p') },
    { label: '720p', value: '720p', url: videoUrl.replace('video', 'video_720p') },
    { label: '480p', value: '480p', url: videoUrl.replace('video', 'video_480p') }
  ]);

  // 格式化时间
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 播放/暂停
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // 进度条点击
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const newTime = clickPercent * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // 音量控制
  const handleVolumeChange = (value: number) => {
    if (!videoRef.current) return;

    const newVolume = value / 100;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  // 静音切换
  const toggleMute = () => {
    if (!videoRef.current) return;

    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  // 全屏
  const toggleFullscreen = () => {
    if (!videoRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

  // 下载视频
  const handleDownload = () => {
    if (onDownload) {
      onDownload(videoUrl);
    } else {
      // 默认下载逻辑
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `video_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success('开始下载视频');
    }
  };

  // 清晰度切换
  const handleQualityChange = (quality: string) => {
    const currentTime = videoRef.current?.currentTime || 0;
    const selectedQuality = qualities.find(q => q.value === quality);

    if (selectedQuality && videoRef.current) {
      setIsLoading(true);
      setCurrentQuality(quality);
      videoRef.current.src = selectedQuality.url;

      videoRef.current.onloadeddata = () => {
        videoRef.current!.currentTime = currentTime;
        if (isPlaying) {
          videoRef.current!.play();
        }
        setIsLoading(false);
      };
    }
  };

  // 清晰度选项
  const qualityMenuItems = qualities.map(quality => ({
    key: quality.value,
    label: quality.label,
    onClick: () => handleQualityChange(quality.value),
    disabled: quality.value === currentQuality
  }));

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div style={{ width, position: 'relative' }}>
      {/* 视频容器 */}
      <div
        style={{
          width: '100%',
          paddingBottom: `${(height / width) * 100}%`,
          position: 'relative',
          background: '#000',
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      >
        <video
          ref={videoRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
          poster={posterUrl}
          preload="metadata"
        />

        {/* 加载指示器 */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0, 0, 0, 0.7)',
              padding: '20px',
              borderRadius: '8px'
            }}
          >
            <Spin size="large" />
          </div>
        )}

        {/* 控制条 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.8))',
            padding: '20px',
            opacity: 0,
            transition: 'opacity 0.3s'
          }}
          className="video-controls"
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0';
          }}
        >
          {/* 进度条 */}
          <div
            style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '2px',
              cursor: 'pointer',
              marginBottom: '12px'
            }}
            onClick={handleProgressClick}
          >
            <div
              style={{
                width: `${(currentTime / duration) * 100}%`,
                height: '100%',
                background: '#1890ff',
                borderRadius: '2px'
              }}
            />
          </div>

          {/* 控制按钮 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Space>
              {/* 播放/暂停 */}
              <Button
                type="text"
                icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                onClick={togglePlay}
                style={{ color: '#fff' }}
              />

              {/* 音量控制 */}
              <Space>
                <Button
                  type="text"
                  icon={isMuted ? <MutedOutlined /> : <SoundOutlined />}
                  onClick={toggleMute}
                  style={{ color: '#fff' }}
                />
                <Select
                  value={Math.round(volume * 100)}
                  onChange={handleVolumeChange}
                  style={{ width: '80px' }}
                  size="small"
                >
                  <Select.Option value={0}>0%</Select.Option>
                  <Select.Option value={25}>25%</Select.Option>
                  <Select.Option value={50}>50%</Select.Option>
                  <Select.Option value={75}>75%</Select.Option>
                  <Select.Option value={100}>100%</Select.Option>
                </Select>
              </Space>

              {/* 时间显示 */}
              <span style={{ color: '#fff', fontSize: '12px' }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </Space>

            <Space>
              {/* 清晰度切换 */}
              <Dropdown
                menu={{ items: qualityMenuItems }}
                trigger={['click']}
              >
                <Button
                  type="text"
                  icon={<SettingOutlined />}
                  style={{ color: '#fff' }}
                >
                  {qualities.find(q => q.value === currentQuality)?.label}
                </Button>
              </Dropdown>

              {/* 全屏 */}
              <Button
                type="text"
                icon={<FullscreenOutlined />}
                onClick={toggleFullscreen}
                style={{ color: '#fff' }}
              />

              {/* 下载 */}
              {showDownload && (
                <Button
                  type="text"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  style={{ color: '#fff' }}
                />
              )}
            </Space>
          </div>
        </div>

        {/* 居中播放按钮（未播放时显示） */}
        {!isPlaying && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              cursor: 'pointer'
            }}
            onClick={togglePlay}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                background: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <PlayCircleOutlined style={{ fontSize: '30px', color: '#fff' }} />
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .video-controls:hover {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}