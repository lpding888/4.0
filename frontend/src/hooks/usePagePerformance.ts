/**
 * 页面性能打点Hook
 * 艹！在关键页面组件中使用这个Hook，自动收集性能数据！
 *
 * 使用示例：
 * ```tsx
 * function ChatPage() {
 *   usePagePerformance('/workspace/chat');
 *   return <div>...</div>;
 * }
 * ```
 *
 * @author 老王
 */

import { useEffect, useRef } from 'react';
import { pagePerformanceMonitor } from '@/lib/monitoring/page-performance';

/**
 * 页面性能打点Hook
 *
 * @param pagePath 页面路径（用于标识页面）
 * @param options 可选配置
 */
export function usePagePerformance(
  pagePath: string,
  options?: {
    trackFirstScreen?: boolean; // 是否记录首屏时间（默认true）
    trackInteraction?: boolean; // 是否记录首次交互时间（默认true）
  }
) {
  const startTimeRef = useRef<number>(Date.now());
  const isFirstScreenTrackedRef = useRef(false);
  const isInteractionTrackedRef = useRef(false);

  useEffect(() => {
    const startTime = startTimeRef.current;

    // 记录首屏时间（页面挂载完成）
    if (options?.trackFirstScreen !== false && !isFirstScreenTrackedRef.current) {
      const firstScreenTime = Date.now() - startTime;

      pagePerformanceMonitor.recordMetric({
        page: pagePath,
        metric_name: 'FirstScreen',
        metric_value: firstScreenTime,
        rating: firstScreenTime <= 2000 ? 'good' : firstScreenTime <= 3000 ? 'needs-improvement' : 'poor',
        timestamp: Date.now(),
        additional_data: {
          description: '首屏渲染时间（页面挂载完成）',
        },
      });

      isFirstScreenTrackedRef.current = true;
    }

    // 记录首次交互时间（监听用户首次点击/输入）
    if (options?.trackInteraction !== false && !isInteractionTrackedRef.current) {
      const handleFirstInteraction = () => {
        const interactionTime = Date.now() - startTime;

        pagePerformanceMonitor.recordMetric({
          page: pagePath,
          metric_name: 'TimeToInteractive',
          metric_value: interactionTime,
          rating: interactionTime <= 3000 ? 'good' : interactionTime <= 5000 ? 'needs-improvement' : 'poor',
          timestamp: Date.now(),
          additional_data: {
            description: '可交互时间（用户首次交互）',
          },
        });

        isInteractionTrackedRef.current = true;

        // 移除事件监听
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('keydown', handleFirstInteraction);
      };

      document.addEventListener('click', handleFirstInteraction, { once: true });
      document.addEventListener('keydown', handleFirstInteraction, { once: true });

      return () => {
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('keydown', handleFirstInteraction);
      };
    }
  }, [pagePath, options]);

  return {
    /**
     * 手动记录自定义性能指标
     */
    recordCustomMetric: (metricName: string, metricValue: number, rating?: 'good' | 'needs-improvement' | 'poor') => {
      pagePerformanceMonitor.recordMetric({
        page: pagePath,
        metric_name: metricName,
        metric_value: metricValue,
        rating: rating || 'good',
        timestamp: Date.now(),
      });
    },
  };
}
