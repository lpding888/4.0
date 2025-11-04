# A11Y-P2-ACCESS-206: 可访问性优化使用指南

## 📋 概述

本文档介绍了项目的可访问性（A11y）优化实施方案，包括工具库、样式规范、检查流程和最佳实践。

**目标**：关键路径 Lighthouse 可访问性得分 ≥ 90

## 🎯 实施内容

### 1. ESLint 可访问性检查

已配置 `eslint-plugin-jsx-a11y` 插件，自动检查可访问性问题。

**配置文件**: `.eslintrc.json`

**检查命令**:
```bash
npm run lint          # 检查代码
npm run lint:fix      # 自动修复部分问题
```

**主要规则**:
- ✅ 图片必须有 alt 属性
- ✅ 按钮和链接必须有可访问的内容
- ✅ 表单元素必须有关联的标签
- ✅ ARIA 属性必须正确使用
- ✅ 交互元素必须支持键盘操作
- ✅ 颜色对比度必须符合标准

### 2. 可访问性工具库

**位置**: `src/lib/accessibility/index.ts`

#### 2.1 键盘导航钩子

```tsx
import { useKeyboardNavigation } from '@/lib/accessibility';

function MyComponent() {
  const { handleKeyDown } = useKeyboardNavigation({
    onUp: () => console.log('上'),
    onDown: () => console.log('下'),
    onEnter: () => console.log('确认'),
    onEscape: () => console.log('取消'),
  });

  return <div onKeyDown={handleKeyDown}>可键盘操作的组件</div>;
}
```

#### 2.2 焦点陷阱 (Focus Trap)

用于模态框、抽屉等场景，确保焦点在容器内循环：

```tsx
import { useFocusTrap } from '@/lib/accessibility';
import { useRef, useEffect } from 'react';

function Modal() {
  const modalRef = useRef<HTMLDivElement>(null);
  const { trapFocus } = useFocusTrap(modalRef);

  useEffect(() => {
    const cleanup = trapFocus();
    return cleanup;
  }, []);

  return (
    <div ref={modalRef} role="dialog" aria-modal="true">
      <h2>模态框标题</h2>
      <button>按钮1</button>
      <button>按钮2</button>
    </div>
  );
}
```

#### 2.3 焦点管理器

```tsx
import { FocusManager } from '@/lib/accessibility';

const focusManager = new FocusManager();

// 打开模态框前保存焦点
focusManager.saveFocus();

// 设置焦点到模态框第一个元素
focusManager.focusFirstElement(modalElement);

// 关闭模态框后恢复焦点
focusManager.restoreFocus();
```

#### 2.4 屏幕阅读器通知

```tsx
import { announceToScreenReader } from '@/lib/accessibility';

// 通知用户操作成功
announceToScreenReader('保存成功', 'polite');

// 通知紧急错误
announceToScreenReader('操作失败，请重试', 'assertive');
```

#### 2.5 视觉隐藏文本

```tsx
import { VisuallyHidden } from '@/lib/accessibility';

function IconButton() {
  return (
    <button>
      <IconSearch />
      <VisuallyHidden>搜索</VisuallyHidden>
    </button>
  );
}
```

#### 2.6 ARIA 属性生成器

```tsx
import { generateAriaProps } from '@/lib/accessibility';

function Accordion({ expanded }: { expanded: boolean }) {
  const ariaProps = generateAriaProps({
    label: '折叠面板',
    expanded,
    disabled: false,
  });

  return <div {...ariaProps}>内容</div>;
}
```

#### 2.7 颜色对比度检查

```tsx
import { getContrastRatio, meetsWCAGAA } from '@/lib/accessibility';

// 检查对比度
const ratio = getContrastRatio('#000000', '#ffffff'); // 21
const passes = meetsWCAGAA('#000000', '#ffffff'); // true

// 大文本（18pt以上）
const passesLarge = meetsWCAGAA('#666666', '#ffffff', true);
```

### 3. 可访问性样式

**位置**: `src/styles/accessibility.css`

#### 3.1 屏幕阅读器专用样式

```html
<!-- 视觉隐藏，但屏幕阅读器可读 -->
<span class="sr-only">仅供屏幕阅读器的描述文本</span>

<!-- 获得焦点时显示（用于"跳过导航"链接） -->
<a href="#main-content" class="sr-only-focusable">跳过导航</a>
```

#### 3.2 统一焦点样式

所有可聚焦元素自动应用焦点样式：
- 2px 蓝色边框
- 2px 偏移量
- 4px 蓝色半透明阴影

#### 3.3 支持用户偏好

```css
/* 高对比度模式 */
@media (prefers-contrast: high) {
  *:focus-visible {
    outline-width: 3px;
  }
}

/* 减少动画模式 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 4. Lighthouse 自动化检查

**脚本位置**: `scripts/lighthouse-a11y.js`

#### 4.1 安装依赖

```bash
npm run a11y:install
```

#### 4.2 运行检查

```bash
# 启动开发服务器
npm run dev

# 在另一个终端运行检查
npm run a11y:check
```

#### 4.3 自定义配置

通过环境变量自定义检查：

```bash
# 自定义基础URL
BASE_URL=http://localhost:3000 npm run a11y:check

# 自定义最低得分
MIN_SCORE=95 npm run a11y:check
```

#### 4.4 查看报告

检查完成后，详细报告保存在 `lighthouse-reports/` 目录：

```
lighthouse-reports/
├── 首页-2024-01-15T12-00-00-000Z.html
├── 模板中心-2024-01-15T12-01-00-000Z.html
└── AI商拍工作室-2024-01-15T12-02-00-000Z.html
```

### 5. 跳过导航链接

已在根布局中添加"跳过导航"链接：

```tsx
// src/app/layout.tsx
<a href="#main-content" className="sr-only-focusable">
  跳过导航，直达主内容
</a>

<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

**使用方法**：
1. 页面加载后按 Tab 键
2. 第一个聚焦元素就是"跳过导航"链接
3. 按 Enter 键直接跳转到主内容区域

## 📝 最佳实践

### 1. 图片可访问性

```tsx
// ✅ 好的做法
<img src="/image.jpg" alt="春季新品连衣裙，蓝色印花" />

// ❌ 避免
<img src="/image.jpg" /> // 缺少 alt
<img src="/image.jpg" alt="图片" /> // alt 内容不具体

// 装饰性图片
<img src="/decoration.jpg" alt="" role="presentation" />
```

### 2. 按钮可访问性

```tsx
// ✅ 好的做法
<button>
  <IconDelete />
  <VisuallyHidden>删除</VisuallyHidden>
</button>

// 或使用 aria-label
<button aria-label="删除">
  <IconDelete />
</button>

// ❌ 避免
<button>
  <IconDelete />
</button> // 没有文本内容，屏幕阅读器无法识别
```

### 3. 表单可访问性

```tsx
// ✅ 好的做法
<label htmlFor="username">用户名</label>
<input
  id="username"
  type="text"
  aria-required="true"
  aria-describedby="username-help"
/>
<span id="username-help">请输入6-20个字符</span>

// 错误状态
<input
  id="username"
  type="text"
  aria-invalid="true"
  aria-describedby="username-error"
/>
<span id="username-error" role="alert">
  用户名不能为空
</span>
```

### 4. 模态框可访问性

```tsx
function Modal({ isOpen, onClose, title, children }) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { trapFocus } = useFocusTrap(modalRef);
  const focusManager = new FocusManager();

  useEffect(() => {
    if (isOpen) {
      focusManager.saveFocus();
      const cleanup = trapFocus();
      focusManager.focusFirstElement(modalRef.current!);

      return () => {
        cleanup?.();
        focusManager.restoreFocus();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h2 id="modal-title">{title}</h2>
        {children}
        <button onClick={onClose}>关闭</button>
      </div>
    </>
  );
}
```

### 5. 列表可访问性

```tsx
// ✅ 好的做法
<ul role="list">
  <li>项目1</li>
  <li>项目2</li>
  <li>项目3</li>
</ul>

// 交互式列表
<div role="listbox" aria-label="选择模板">
  <div role="option" aria-selected="false" tabIndex={0}>
    模板1
  </div>
  <div role="option" aria-selected="true" tabIndex={0}>
    模板2
  </div>
</div>
```

### 6. 标题层级

```tsx
// ✅ 好的做法
<h1>页面标题</h1>
  <h2>章节标题</h2>
    <h3>子章节标题</h3>
    <h3>子章节标题</h3>
  <h2>章节标题</h2>

// ❌ 避免跳级
<h1>页面标题</h1>
  <h3>直接跳到h3</h3> // 不好
```

### 7. 颜色对比度

确保文本和背景的对比度符合 WCAG AA 标准：

- **普通文本**：对比度 ≥ 4.5:1
- **大文本**（18pt以上或14pt粗体）：对比度 ≥ 3:1

```tsx
// 检查颜色对比度
import { meetsWCAGAA } from '@/lib/accessibility';

const textColor = '#666666';
const bgColor = '#ffffff';

if (!meetsWCAGAA(textColor, bgColor)) {
  console.warn('颜色对比度不足！');
}
```

### 8. 键盘导航

确保所有交互元素可以通过键盘访问：

```tsx
// 自定义可点击元素（非button/a）
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  点击我
</div>
```

## 🔍 常见问题

### Q1: 为什么我的图标按钮没有焦点样式？

A: 确保按钮有文本内容或 aria-label：

```tsx
// 方法1：使用 VisuallyHidden
<button>
  <IconSearch />
  <VisuallyHidden>搜索</VisuallyHidden>
</button>

// 方法2：使用 aria-label
<button aria-label="搜索">
  <IconSearch />
</button>
```

### Q2: 如何隐藏装饰性图片？

A: 使用空的 alt 属性和 role="presentation"：

```tsx
<img src="/decoration.jpg" alt="" role="presentation" />
```

### Q3: 模态框打开后如何防止焦点跑到背景？

A: 使用 `useFocusTrap` 钩子和 `aria-modal="true"`：

```tsx
const modalRef = useRef<HTMLDivElement>(null);
const { trapFocus } = useFocusTrap(modalRef);

<div ref={modalRef} role="dialog" aria-modal="true">
  {/* 模态框内容 */}
</div>
```

### Q4: Lighthouse 检查失败如何调试？

A: 查看详细报告（在 `lighthouse-reports/` 目录），重点检查：

1. 图片是否有 alt 属性
2. 按钮是否有可访问的名称
3. 表单元素是否有关联的标签
4. 颜色对比度是否符合标准
5. 页面是否有正确的标题层级

## 📚 参考资源

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [React Accessibility](https://react.dev/learn/accessibility)
- [Ant Design Accessibility](https://ant.design/docs/spec/accessibility)
- [eslint-plugin-jsx-a11y](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y)

## ✅ 验收标准

- [x] ESLint 可访问性规则配置完成
- [x] 可访问性工具库实现（键盘导航、焦点管理、ARIA工具）
- [x] 可访问性样式文件创建
- [x] Lighthouse 自动化检查脚本
- [x] 根布局添加"跳过导航"链接
- [x] 主内容区域标记为 `<main>`
- [ ] 关键页面 Lighthouse A11y 得分 ≥ 90
- [ ] 所有图片有合适的 alt 属性
- [ ] 所有交互元素支持键盘操作
- [ ] 颜色对比度符合 WCAG AA 标准

## 🎉 总结

本次可访问性优化实施了完整的工具链和最佳实践，包括：

1. ✅ **ESLint 自动检查**：在开发阶段就发现可访问性问题
2. ✅ **工具库支持**：提供键盘导航、焦点管理、ARIA等实用工具
3. ✅ **统一样式规范**：确保焦点样式、对比度等符合标准
4. ✅ **自动化测试**：Lighthouse 脚本自动检查关键页面
5. ✅ **文档完善**：详细的使用指南和最佳实践

通过这些优化，网站将对所有用户（包括使用屏幕阅读器、键盘导航等辅助技术的用户）更加友好！

---

**艹！老王我这次搞得够专业吧！** 🎯
