/**
 * 可访问性工具库
 * 提供键盘导航、焦点管理、ARIA属性等辅助功能
 */

import React from 'react';

/**
 * 键盘导航钩子
 * 支持方向键、Tab、Escape等常用键盘操作
 */
export const useKeyboardNavigation = (options: {
  onUp?: () => void;
  onDown?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onTab?: () => void;
}) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const { key } = event;

    switch (key) {
      case 'ArrowUp':
        event.preventDefault();
        options.onUp?.();
        break;
      case 'ArrowDown':
        event.preventDefault();
        options.onDown?.();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        options.onLeft?.();
        break;
      case 'ArrowRight':
        event.preventDefault();
        options.onRight?.();
        break;
      case 'Enter':
        event.preventDefault();
        options.onEnter?.();
        break;
      case 'Escape':
        event.preventDefault();
        options.onEscape?.();
        break;
      case 'Tab':
        // Tab默认行为保留，只触发回调
        options.onTab?.();
        break;
    }
  };

  return { handleKeyDown };
};

/**
 * 焦点陷阱 (Focus Trap)
 * 用于模态框、抽屉等场景，确保焦点在容器内循环
 */
export const useFocusTrap = (containerRef: React.RefObject<HTMLElement>) => {
  const trapFocus = () => {
    if (!containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    containerRef.current.addEventListener('keydown', handleTabKey);

    return () => {
      containerRef.current?.removeEventListener('keydown', handleTabKey);
    };
  };

  return { trapFocus };
};

/**
 * 焦点管理器
 * 保存和恢复焦点状态
 */
export class FocusManager {
  private previousActiveElement: HTMLElement | null = null;

  /**
   * 保存当前焦点
   */
  saveFocus() {
    this.previousActiveElement = document.activeElement as HTMLElement;
  }

  /**
   * 恢复之前的焦点
   */
  restoreFocus() {
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      this.previousActiveElement.focus();
    }
  }

  /**
   * 设置焦点到指定元素
   */
  setFocus(element: HTMLElement | null) {
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  }

  /**
   * 移动焦点到容器内第一个可聚焦元素
   */
  focusFirstElement(container: HTMLElement) {
    const firstFocusable = container.querySelector(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;

    if (firstFocusable) {
      firstFocusable.focus();
    }
  }
}

/**
 * ARIA实时区域 (Live Region) 工具
 * 用于通知屏幕阅读器用户动态内容变化
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.className = 'sr-only'; // 屏幕阅读器可读，视觉隐藏
  liveRegion.textContent = message;

  document.body.appendChild(liveRegion);

  // 1秒后移除
  setTimeout(() => {
    document.body.removeChild(liveRegion);
  }, 1000);
};

/**
 * 跳过导航链接 (Skip to Content)
 * 允许键盘用户快速跳过导航直达主内容
 */
export const SkipToContent: React.FC<{ targetId: string; children: React.ReactNode }> = ({
  targetId,
  children,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only-focusable"
      style={{
        position: 'absolute',
        left: '-9999px',
        zIndex: 9999,
      }}
      onFocus={(e) => {
        e.currentTarget.style.left = '0';
      }}
      onBlur={(e) => {
        e.currentTarget.style.left = '-9999px';
      }}
    >
      {children}
    </a>
  );
};

/**
 * 颜色对比度检查
 * 检查前景色和背景色是否符合WCAG 2.1 AA标准（对比度 >= 4.5:1）
 */
export const getContrastRatio = (foreground: string, background: string): number => {
  // 将hex转为RGB
  const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;

    const [, rHex, gHex, bHex] = result;
    if (!rHex || !gHex || !bHex) return null;

    return {
      r: parseInt(rHex, 16),
      g: parseInt(gHex, 16),
      b: parseInt(bHex, 16)
    };
  };

  // 计算相对亮度
  const getLuminance = (rgb: { r: number; g: number; b: number }): number => {
    const { r, g, b } = rgb;
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
  };

  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);

  if (!fg || !bg) return 0;

  const l1 = getLuminance(fg);
  const l2 = getLuminance(bg);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * 检查对比度是否符合WCAG AA标准
 */
export const meetsWCAGAA = (foreground: string, background: string, isLargeText = false): boolean => {
  const ratio = getContrastRatio(foreground, background);
  // 大文本要求对比度 >= 3:1，普通文本 >= 4.5:1
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
};

/**
 * 可访问性属性生成器
 */
export const generateAriaProps = (options: {
  label?: string;
  labelledBy?: string;
  describedBy?: string;
  expanded?: boolean;
  selected?: boolean;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  live?: 'off' | 'polite' | 'assertive';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
}) => {
  const props: Record<string, any> = {};

  if (options.label) props['aria-label'] = options.label;
  if (options.labelledBy) props['aria-labelledby'] = options.labelledBy;
  if (options.describedBy) props['aria-describedby'] = options.describedBy;
  if (typeof options.expanded === 'boolean') props['aria-expanded'] = options.expanded;
  if (typeof options.selected === 'boolean') props['aria-selected'] = options.selected;
  if (typeof options.disabled === 'boolean') props['aria-disabled'] = options.disabled;
  if (typeof options.required === 'boolean') props['aria-required'] = options.required;
  if (typeof options.invalid === 'boolean') props['aria-invalid'] = options.invalid;
  if (options.live) props['aria-live'] = options.live;
  if (typeof options.atomic === 'boolean') props['aria-atomic'] = options.atomic;
  if (options.relevant) props['aria-relevant'] = options.relevant;

  return props;
};

/**
 * 屏幕阅读器专用文本
 * 视觉隐藏但可被屏幕阅读器读取
 */
export const VisuallyHidden: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <span
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: 0,
      }}
    >
      {children}
    </span>
  );
};

/**
 * 导出所有工具
 */
export default {
  useKeyboardNavigation,
  useFocusTrap,
  FocusManager,
  announceToScreenReader,
  SkipToContent,
  getContrastRatio,
  meetsWCAGAA,
  generateAriaProps,
  VisuallyHidden,
};
