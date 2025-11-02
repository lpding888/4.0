# TASK-FE-002：动态功能配置管理（消灭670行硬编码）

## 📋 任务元信息

| 属性 | 值 |
|------|-----|
| **任务ID** | TASK-FE-002 |
| **任务类型** | Frontend Refactoring |
| **优先级** | P0 - 紧急重要 |
| **预计工时** | 2-3天 |
| **依赖任务** | TASK-FE-001（需要完成架构搭建） |
| **负责Skill** | frontend-dev |
| **关联文档** | `docs/GPT5问题-前端架构设计.md` - 问题2 |

---

## 🎯 任务目标

将`frontend/src/app/page.tsx`中硬编码的670行功能配置改造为**数据驱动**的动态加载方式：

### 当前问题
```tsx
// frontend/src/app/page.tsx（硬编码，SB代码！）
const features = [
  {
    id: 'background_removal',
    name: '智能抠图',
    icon: <ScissorOutlined />,
    description: '一键去除图片背景',
    quotaCost: 1,
  },
  // ... 重复670行 ...
];
```

### 改造后
```tsx
// 从后端API动态加载
const { data: features } = useRequest('/api/features');
// features 自动从后端feature_definitions表读取
```

---

## 📦 核心交付物

### 1. TypeScript类型定义

**`features/workspace/types/index.ts`**
```typescript
// 功能定义（对应后端feature_definitions表）
export interface FeatureDefinition {
  feature_id: string;
  name: string;
  description: string;
  icon: string;                 // 字符串，如"ScissorOutlined"
  category: string;             // 'image' | 'video' | 'tool'
  quota_cost: number;
  status: 'active' | 'inactive';
  sort_order: number;
  created_at: string;
}

// 功能分类
export interface FeatureCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

// 筛选条件
export interface FeatureFilter {
  category?: string;
  search?: string;
  sortBy?: 'name' | 'quota_cost' | 'sort_order';
  sortOrder?: 'asc' | 'desc';
}
```

### 2. 动态图标渲染方案

**`shared/ui/DynamicIcon/index.tsx`** - 核心组件
```typescript
import React from 'react';
import * as AntdIcons from '@ant-design/icons';

interface DynamicIconProps {
  iconName: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 动态渲染Ant Design图标
 * @param iconName - 图标名称字符串，如"ScissorOutlined"
 */
export const DynamicIcon: React.FC<DynamicIconProps> = ({ iconName, className, style }) => {
  // 从Ant Design Icons库中动态获取图标组件
  const IconComponent = (AntdIcons as any)[iconName];

  if (!IconComponent) {
    console.warn(`图标 "${iconName}" 不存在，使用默认图标`);
    return <AntdIcons.QuestionCircleOutlined className={className} style={style} />;
  }

  return <IconComponent className={className} style={style} />;
};
```

**使用示例：**
```tsx
<DynamicIcon iconName="ScissorOutlined" style={{ fontSize: 24 }} />
// 后端返回 icon: "ScissorOutlined"，前端自动渲染对应图标
```

### 3. FeatureCard 通用组件

**`features/workspace/ui/FeatureCard/index.tsx`**
```typescript
import React from 'react';
import { Card, Tag } from 'antd';
import { DynamicIcon } from '@/shared/ui/DynamicIcon';
import type { FeatureDefinition } from '../../types';
import styles from './index.module.css';

interface FeatureCardProps {
  feature: FeatureDefinition;
  onClick?: (featureId: string) => void;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({ feature, onClick }) => {
  const handleClick = () => {
    if (feature.status === 'inactive') return; // 禁用功能不可点击
    onClick?.(feature.feature_id);
  };

  return (
    <Card
      hoverable={feature.status === 'active'}
      className={styles.featureCard}
      onClick={handleClick}
    >
      <div className={styles.iconWrapper}>
        <DynamicIcon iconName={feature.icon} className={styles.icon} />
      </div>
      <h3 className={styles.title}>{feature.name}</h3>
      <p className={styles.description}>{feature.description}</p>
      <div className={styles.footer}>
        <Tag color="blue">{feature.quota_cost} 配额</Tag>
        {feature.status === 'inactive' && <Tag color="red">维护中</Tag>}
      </div>
    </Card>
  );
};
```

**`features/workspace/ui/FeatureCard/index.module.css`**
```css
.featureCard {
  border-radius: 12px;
  transition: all 0.3s;
}

.featureCard:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(91, 97, 237, 0.15);
}

.iconWrapper {
  text-align: center;
  margin-bottom: 16px;
}

.icon {
  font-size: 48px;
  color: var(--ant-primary-color);
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.description {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
  min-height: 40px;
}

.footer {
  display: flex;
  gap: 8px;
  justify-content: center;
}
```

### 4. FeatureGrid 通用组件

**`features/workspace/ui/FeatureGrid/index.tsx`**
```typescript
import React, { useMemo } from 'react';
import { Row, Col, Empty, Spin } from 'antd';
import { FeatureCard } from '../FeatureCard';
import type { FeatureDefinition, FeatureFilter } from '../../types';

interface FeatureGridProps {
  features: FeatureDefinition[];
  filter?: FeatureFilter;
  loading?: boolean;
  onFeatureClick?: (featureId: string) => void;
}

export const FeatureGrid: React.FC<FeatureGridProps> = ({
  features,
  filter,
  loading,
  onFeatureClick,
}) => {
  // 筛选和排序逻辑
  const filteredFeatures = useMemo(() => {
    let result = [...features];

    // 分类筛选
    if (filter?.category) {
      result = result.filter((f) => f.category === filter.category);
    }

    // 搜索筛选
    if (filter?.search) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(searchLower) ||
          f.description.toLowerCase().includes(searchLower)
      );
    }

    // 排序
    if (filter?.sortBy) {
      result.sort((a, b) => {
        const aVal = a[filter.sortBy!];
        const bVal = b[filter.sortBy!];
        const order = filter.sortOrder === 'desc' ? -1 : 1;
        return aVal > bVal ? order : -order;
      });
    }

    return result;
  }, [features, filter]);

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (filteredFeatures.length === 0) {
    return <Empty description="暂无功能" />;
  }

  return (
    <Row gutter={[24, 24]}>
      {filteredFeatures.map((feature) => (
        <Col key={feature.feature_id} xs={24} sm={12} md={8} lg={6}>
          <FeatureCard feature={feature} onClick={onFeatureClick} />
        </Col>
      ))}
    </Row>
  );
};
```

### 5. API数据加载与缓存

**`features/workspace/api/getFeatures.ts`**
```typescript
import { apiClient } from '@/shared/api/client';
import type { FeatureDefinition } from '../types';

export interface GetFeaturesParams {
  category?: string;
  status?: 'active' | 'inactive';
}

export const getFeatures = async (params?: GetFeaturesParams) => {
  const response = await apiClient.get<App.ApiResponse<FeatureDefinition[]>>(
    '/api/features',
    { params }
  );
  return response.data.data;
};
```

**`features/workspace/ui/WorkspacePage.tsx`** - 使用示例
```typescript
import React, { useState } from 'react';
import { Tabs, Input } from 'antd';
import { useRequest } from '@/shared/hooks/useRequest';
import { getFeatures } from '../api/getFeatures';
import { FeatureGrid } from './FeatureGrid';
import type { FeatureFilter } from '../types';

export const WorkspacePage: React.FC = () => {
  const [filter, setFilter] = useState<FeatureFilter>({});

  // 使用TanStack Query缓存（推荐）或自定义useRequest
  const { data: features, isLoading } = useRequest(
    ['features', filter.category],
    () => getFeatures({ category: filter.category })
  );

  const handleFeatureClick = (featureId: string) => {
    console.log('打开功能：', featureId);
    // 跳转到功能详情页或打开Modal
  };

  return (
    <div>
      <Input.Search
        placeholder="搜索功能..."
        style={{ marginBottom: 24, maxWidth: 400 }}
        onChange={(e) => setFilter({ ...filter, search: e.target.value })}
      />

      <Tabs
        items={[
          { key: 'all', label: '全部' },
          { key: 'image', label: '图片处理' },
          { key: 'video', label: '视频处理' },
          { key: 'tool', label: '工具' },
        ]}
        onChange={(category) =>
          setFilter({ ...filter, category: category === 'all' ? undefined : category })
        }
      />

      <FeatureGrid
        features={features || []}
        filter={filter}
        loading={isLoading}
        onFeatureClick={handleFeatureClick}
      />
    </div>
  );
};
```

---

## ✅ 验收标准

### 功能验收
- [ ] 访问`/workspace`页面，功能列表从后端API动态加载
- [ ] 后端修改`feature_definitions`表数据，前端立即看到变化（无需重新部署）
- [ ] 图标字符串（如`"ScissorOutlined"`）正确渲染为Ant Design图标
- [ ] 分类筛选、搜索筛选、排序功能正常工作
- [ ] 点击功能卡片，正确触发`onFeatureClick`回调

### 性能验收
- [ ] 功能列表API请求使用缓存（TanStack Query）
- [ ] 5秒内不重复请求同一API
- [ ] 筛选/排序操作在前端完成，不重新请求API

### 代码质量
- [ ] 删除`page.tsx`中原有的670行硬编码配置
- [ ] 所有组件通过TypeScript严格检查
- [ ] `DynamicIcon`组件有单元测试覆盖

---

## 🔧 技术要求

### API接口要求（后端需提供）

**GET /api/features**
```json
{
  "success": true,
  "data": [
    {
      "feature_id": "background_removal",
      "name": "智能抠图",
      "description": "一键去除图片背景",
      "icon": "ScissorOutlined",
      "category": "image",
      "quota_cost": 1,
      "status": "active",
      "sort_order": 1,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 缓存策略
- 使用TanStack Query的`staleTime: 5 * 60 * 1000`（5分钟）
- 手动刷新时调用`queryClient.invalidateQueries(['features'])`

---

## 📚 参考资料

1. **动态导入图标**：https://ant.design/components/icon-cn#%E5%8A%A8%E6%80%81%E5%8A%A0%E8%BD%BD
2. **TanStack Query缓存**：https://tanstack.com/query/latest/docs/framework/react/guides/caching

---

## 🚨 注意事项

1. **图标名称必须精确匹配**：
   - 后端存储：`"ScissorOutlined"`（不是`"scissor"`）
   - Ant Design图标库包含300+图标，名称区分大小写

2. **后端数据兼容性**：
   - 确保后端已创建`feature_definitions`表（迁移文件）
   - 确保初始数据包含`icon`字段

3. **渐进式迁移**：
   - 保留旧的硬编码配置作为fallback
   - 新功能优先从API加载，失败时使用硬编码
   - 验证稳定后再删除硬编码

---

**艹！这个任务完成后，工作台的670行硬编码就能全部删掉，产品经理想加功能直接改数据库就行！** 🔥
