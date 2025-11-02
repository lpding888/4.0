# 任务卡:前端开发 - 批量处理功能

> **负责技能**:frontend_dev_skill
> **功能模块**:批量处理功能
> **任务类型**:前端用户端开发
> **优先级**:P0

---

## 任务目标

实现批量处理功能的前端界面,包括批量上传组件、模式切换Tab、批量任务详情页、任务列表页改造等。

---

## 目录范围

### ✅ 可修改
- `frontend/src/components/BatchImageUploader.tsx`(新建)
- `frontend/src/components/DynamicForm.tsx`(修改)
- `frontend/src/app/task/batch/[taskId]/page.tsx`(新建)
- `frontend/src/app/workspace/page.tsx`(修改)
- `frontend/src/types/index.ts`(扩展类型定义)

### ❌ 禁止修改
- `frontend/src/lib/api.ts`(API封装,只新增不修改)
- `frontend/src/components/ImageUploader.tsx`(单张上传组件)

---

## 产出物清单

### 1. 新建组件
- `<BatchImageUploader/>` - 批量图片上传组件
- `/task/batch/[taskId]/page.tsx` - 批量任务详情页

### 2. 改造组件
- `<DynamicForm/>` - 支持单张/批量模式切换
- `/workspace/page.tsx` - 任务列表显示批量角标

### 3. 类型定义
- `Task`接口扩展(新增is_batch/batch_total等字段)

---

## 核心组件设计

### 1. 批量上传组件<BatchImageUploader/>

**props接口**:
```typescript
interface BatchImageUploaderProps {
  value: string[];  // 已上传图片URL列表
  onChange: (urls: string[]) => void;
  maxCount?: number;  // 最多上传数量,默认50
  quotaCostPerImage?: number;  // 单张配额消耗
}
```

**核心功能**:
- 支持拖拽上传多张图片
- 实时显示每张图片的上传进度
- 前端验证(格式/大小/数量)
- 显示配额消耗预览
- 支持删除已上传图片

**UI结构**:
```tsx
<div className="batch-uploader">
  {/* 已上传图片列表 */}
  <div className="uploaded-images">
    {value.map((url, index) => (
      <div key={index} className="image-item">
        <Image src={url} />
        <Button onClick={() => handleRemove(index)}>删除</Button>
      </div>
    ))}
  </div>

  {/* 上传按钮 */}
  <Upload
    multiple
    customRequest={handleUpload}
    beforeUpload={beforeUpload}
  >
    <Button>+上传图片</Button>
  </Upload>

  {/* 配额消耗预览 */}
  <div className="quota-preview">
    已选择: {value.length}张图片 × {quotaCostPerImage}配额 = {value.length * quotaCostPerImage}配额
  </div>
</div>
```

### 2. 动态表单扩展<DynamicForm/>

**新增状态**:
```typescript
const [mode, setMode] = useState<'single' | 'batch'>('single');
const [batchImages, setBatchImages] = useState<string[]>([]);
```

**模式切换UI**:
```tsx
<Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
  <Radio.Button value="single">单张模式</Radio.Button>
  <Radio.Button value="batch">批量模式</Radio.Button>
</Radio.Group>

{mode === 'single' && (
  <ImageUploadField {...singleImageProps} />
)}

{mode === 'batch' && (
  <BatchImageUploader
    value={batchImages}
    onChange={setBatchImages}
    quotaCostPerImage={schema.quota_cost}
  />
)}
```

**提交逻辑**:
```typescript
const handleSubmit = async () => {
  if (mode === 'single') {
    // 调用单张任务接口
    await api.tasks.create({ feature_id, input_data: formData });
  } else {
    // 调用批量任务接口
    await api.tasks.createBatch({
      feature_id,
      input_images: batchImages,
      input_data: formData
    });
  }
};
```

### 3. 批量任务详情页

**页面路径**: `/task/batch/[taskId]/page.tsx`

**核心功能**:
- 显示批量任务整体进度
- 列表显示每张图片的处理状态
- 支持单独下载/预览
- 支持批量下载ZIP
- 支持重试失败项
- 实时轮询更新进度

**页面结构**:
```tsx
export default function BatchTaskPage({ params }: { params: { taskId: string } }) {
  const [task, setTask] = useState<Task | null>(null);

  // 轮询更新进度
  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await api.tasks.getById(params.taskId);
      setTask(data);

      // 处理完成后停止轮询
      if (data.status === 'success' || data.status === 'partial_success') {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [params.taskId]);

  return (
    <div>
      {/* 进度条 */}
      <Progress
        percent={Math.round((task.batch_success / task.batch_total) * 100)}
      />

      {/* 统计信息 */}
      <div>
        ✅ 成功: {task.batch_success}张
        ❌ 失败: {task.batch_failed}张
        ⏳ 处理中: {task.batch_total - task.batch_success - task.batch_failed}张
      </div>

      {/* 操作按钮 */}
      <Space>
        <Button onClick={handleDownloadZip}>全部下载ZIP</Button>
        <Button onClick={handleRetryFailed}>重试失败项</Button>
      </Space>

      {/* 子任务列表 */}
      <List
        dataSource={task.batch_items}
        renderItem={(item, index) => (
          <List.Item>
            <div>
              {index + 1}. {item.input_url}
              <Tag color={item.status === 'success' ? 'green' : 'red'}>
                {item.status}
              </Tag>
              {item.status === 'success' && (
                <Button onClick={() => handleDownload(item.output_url)}>下载</Button>
              )}
              {item.status === 'failed' && (
                <span>{item.error_message}</span>
              )}
            </div>
          </List.Item>
        )}
      />
    </div>
  );
}
```

### 4. 任务列表页改造

**批量任务卡片**:
```tsx
{task.is_batch && (
  <>
    <Badge count="批量" style={{ backgroundColor: '#1890ff' }} />
    <div>进度: {task.batch_success}/{task.batch_total}</div>
    <Collapse>
      <Panel header="查看子任务">
        {task.batch_items.slice(0, 5).map((item, index) => (
          <div key={index}>
            {item.status === 'success' ? '✅' : '❌'} {item.input_url}
          </div>
        ))}
      </Panel>
    </Collapse>
  </>
)}
```

---

## API调用

### 新增API方法

```typescript
// frontend/src/lib/api.ts

export const api = {
  tasks: {
    // 创建批量任务
    createBatch: async (data: {
      feature_id: string;
      input_images: string[];
      input_data: Record<string, any>;
    }) => {
      const res = await fetch('/api/tasks/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },

    // 下载ZIP
    downloadZip: (taskId: string, successOnly: boolean = true) => {
      window.location.href = `/api/tasks/${taskId}/download-zip?successOnly=${successOnly}`;
    },

    // 重试失败项
    retryFailed: async (taskId: string) => {
      const res = await fetch(`/api/tasks/${taskId}/retry-failed`, {
        method: 'POST'
      });
      return res.json();
    }
  }
};
```

---

## 类型定义扩展

```typescript
// frontend/src/types/index.ts

export interface Task {
  id: string;
  userId: string;
  feature_id: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'partial_success' | 'cancelled';

  // 批量任务字段(新增)
  is_batch: boolean;
  batch_total: number;
  batch_success: number;
  batch_failed: number;
  batch_items: BatchItem[];

  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface BatchItem {
  index: number;
  input_url: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  output_url: string | null;
  error_message: string | null;
}
```

---

## 验证清单

### 功能测试
- [ ] 批量上传10张JPG图片,显示10张缩略图
- [ ] 上传GIF图片,显示红色提示并自动移除
- [ ] 上传51张图片,提示"最多支持50张"
- [ ] 配额消耗计算准确(10张图显示"10配额")
- [ ] 单张/批量模式切换流畅
- [ ] 批量模式提交,跳转到批量任务详情页
- [ ] 批量任务详情页实时显示进度
- [ ] 批量下载ZIP成功
- [ ] 重试失败项功能正常

### UI/UX测试
- [ ] 批量上传组件UI美观
- [ ] 上传进度条显示正确
- [ ] 批量任务详情页布局合理
- [ ] 任务列表批量角标清晰可见
- [ ] 移动端适配良好

---

## 交付方式

```bash
cd frontend
git add src/components/BatchImageUploader.tsx
git add src/components/DynamicForm.tsx
git add src/app/task/batch/[taskId]/page.tsx
git add src/app/workspace/page.tsx
git add src/types/index.ts
git add src/lib/api.ts
git commit -m "feat(frontend): implement batch task UI components"
git push origin develop
```

---

## 预计工作量

**预计时间**:4.5天

**细分**:
- 批量上传组件:1.5天
- 动态表单扩展:1天
- 批量任务详情页:2天
- 任务列表改造:0.5天

---

**任务卡结束**
