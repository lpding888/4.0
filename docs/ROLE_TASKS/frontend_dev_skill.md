# Frontend Dev Skill - 任务卡清单

## 任务1:工作台动态功能卡片列表

**产出物**:
- `frontend/src/app/workspace/page.tsx` (改造)
- `frontend/src/components/FeatureCard.tsx` (新增)

**执行内容**:
- 删除现有硬编码功能卡片列表
- 调用 `GET /api/features?enabled=true` 获取可用功能卡片
- 渲染 FeatureCard 组件,展示:
  - display_name
  - category
  - description
  - quota_cost (显示"消耗X配额")
  - rate_limit_policy (显示"每小时最多X次")
- 点击卡片跳转到 `/task/create/:featureId`
- 对于用户套餐不满足的卡片,显示灰色禁用态 + "升级会员"按钮

**验收标准**:
- 页面不包含任何硬编码的功能ID或功能名称
- 用户看到的卡片列表与后端返回的 features 数组完全一致
- 禁用态卡片不可点击,点击"升级会员"跳转到 `/membership`
- 卡片按 category 分组展示

**禁止事项**:
- 禁止在前端代码中写死功能列表
- 禁止在前端本地判断 plan_required (权限过滤由后端完成)
- 禁止展示 is_enabled=false 的卡片

**依赖项**:
- 后端 GET /api/features 接口已实现

---

## 任务2:动态表单页面(基于 form_schema 渲染)

**产出物**:
- `frontend/src/app/task/create/[featureId]/page.tsx` (新增)
- `frontend/src/components/DynamicForm.tsx` (新增)
- `frontend/src/components/form-fields/ImageUploadField.tsx` (新增)
- `frontend/src/components/form-fields/MultiImageUploadField.tsx` (新增)
- `frontend/src/components/form-fields/EnumField.tsx` (新增)
- `frontend/src/components/form-fields/TextField.tsx` (新增)
- `frontend/src/components/form-fields/NumberField.tsx` (新增)
- `frontend/src/components/form-fields/DateField.tsx` (新增)

**执行内容**:
- 根据路由参数 featureId 调用 `GET /api/features/:featureId/form-schema`
- 解析 form_schema.fields[] 数组
- 根据每个 field.type 渲染对应组件:
  - `imageUpload` → ImageUploadField (复用现有 ImageUploader 组件)
  - `multiImageUpload` → MultiImageUploadField
  - `enum` → EnumField (下拉或单选按钮组)
  - `text` → TextField
  - `number` → NumberField
  - `date` → DateField
- 显示 field.label、field.helpText、required 标识
- 客户端验证:
  - required 字段必填
  - validation.maxSize 文件大小限制
  - validation.allowedTypes 文件类型限制
  - validation.max / validation.min 数值范围
- 提交按钮显示"生成(消耗X配额)",点击前弹出二次确认对话框
- 提交后调用 `POST /api/tasks/create`,传入 feature_id + input_data
- 拿到 taskId 后跳转到 `/task/:taskId`

**验收标准**:
- 同一个动态表单页面可以渲染任意 form_schema,不需要为每个功能写单独页面
- 客户端验证覆盖所有 validation 规则,验证失败时显示明确错误提示
- 二次确认对话框必须显示本次操作将消耗的配额数
- 上传的图片/文件先传到 COS,拿到 URL 后再提交表单

**禁止事项**:
- 禁止为每个功能写死单独的表单页面
- 禁止跳过客户端验证直接提交
- 禁止在表单中收集用户 prompt (所有输入必须是结构化字段)

**依赖项**:
- 后端 GET /api/features/:featureId/form-schema 接口已实现
- 后端 POST /api/tasks/create 接口已实现
- 现有 ImageUploader 组件可复用

---

## 任务3:任务详情页改造(支持多种 output_type)

**产出物**:
- `frontend/src/app/task/[taskId]/page.tsx` (改造)

**执行内容**:
- 调用 `GET /api/tasks/:taskId`,间隔速度:
  - 初始间隔: 3秒
  - 指数退避: 3s → 6s → 12s → 20s(上限)
  - 5分钟后降频: 每 20秒轮询一次
  - 最长轮询时长: 15分钟
  ```typescript
  // 固化常量
  const POLLING_CONFIG = {
    INITIAL_INTERVAL: 3000,
    BACKOFF_MAX: 20000,
    SLOW_DOWN_AFTER: 5 * 60 * 1000,
    MAX_POLLING_DURATION: 15 * 60 * 1000
  };
  ```
- 根据 status 渲染不同状态:
  - `processing`: 显示"生成中..."+ 进度动画
  - `success`: 根据 output_type 展示结果:
    - `singleImage`: 单张大图展示
    - `multiImage`: 九宫格展示
    - `video`: 使用现有 VideoPlayer 组件
    - `zip`: 显示下载按钮
    - `textBundle`: 显示文本内容
  - `failed`: 显示"生成失败,配额已自动返还" + error_message + "重新生成"按钮
- 成功状态下显示操作按钮:
  - "下载"按钮
  - "保存到素材库"按钮(如果 feature.save_to_asset_library=false 才显示,否则已自动保存)
  - "再生成一次"按钮
- 显示任务元信息:
  - 创建时间
  - 完成时间
  - 消耗配额数

**验收标准**:
- 轮询过程中页面不闪烁
- 5种 output_type 都能正确展示
- 失败提示文案固定为"生成失败,配额已自动返还"
- "重新生成"按钮点击后跳转回 `/task/create/:featureId`,并预填上次的表单数据

**禁止事项**:
- 禁止展示内部字段(vendorTaskId、provider_ref、step_index 等)
- 禁止展示供应商相关信息
- 禁止展示任务中间步骤的输出(只展示最终 artifacts)

**依赖项**:
- 后端 GET /api/tasks/:taskId 接口已实现
- 现有 VideoPlayer 组件可复用

---

## 任务4:管理后台 - 功能卡片管理页面

**产出物**:
- `frontend/src/app/admin/features/page.tsx` (新增)
- `frontend/src/app/admin/features/[featureId]/edit/page.tsx` (新增)
- `frontend/src/components/JSONEditor.tsx` (新增,使用 monaco-editor)
- `frontend/src/middleware.ts` (改造,增加 admin 路由守卫)

**执行内容**:

### 4.1 列表页 (`/admin/features`)
- 调用 `GET /api/admin/features` 获取所有功能卡片(包括 is_enabled=false)
- 表格列:
  - feature_id
  - display_name
  - category
  - is_enabled (开关按钮,可直接切换)
  - plan_required
  - access_scope (新增字段)
  - quota_cost
  - rate_limit_policy
  - 操作列:编辑/删除
- "新增功能卡片"按钮:跳转到 `/admin/features/new`
- 点击 is_enabled 开关时:
  - 如果 quota_cost=0 且要开启,弹出红色警告二次确认:
    ```typescript
    if (quotaCost === 0 && newState === true) {
      const confirmed = await confirm(
        '警告:该功能配额为0,开启后可能导致滥用和成本失控。确定要开启吗?',
        { type: 'danger' }
      );
      if (!confirmed) return;
    }
    ```
  - 调用 `PATCH /api/admin/features/:featureId`,只更新 is_enabled 字段

### 4.2 编辑页 (`/admin/features/:featureId/edit`)
- 3个 Tab:
  - **Tab1 功能定义**: 纯表单
    - feature_id (新增时可编辑,编辑时只读)
    - display_name
    - category (下拉选择)
    - description (多行文本)
    - is_enabled (开关)
    - plan_required (下拉:基础/PRO/企业)
    - access_scope (单选:plan/whitelist)
    - allowed_accounts (如果 access_scope=whitelist 才显示,**多行文本,每行一个账号ID**)
    - quota_cost (数字)
    - rate_limit_policy (文本,格式提示:"hourly:3")
    - output_type (下拉)
    - save_to_asset_library (开关)
  - **Tab2 表单Schema**: JSON 编辑器
    - 编辑 form_schema (JSON格式)
    - 实时语法校验
    - 提供示例模板按钮(主图清洁增强/AI模特12分镜/上新合辑短片)
  - **Tab3 执行Pipeline**: JSON 编辑器
    - 编辑 pipeline_schema (JSON格式)
    - 实时语法校验
    - 提供示例模板按钮
- "保存"按钮:
  - 对 allowed_accounts 进行格式化处理(多行文本 → 数组):
    ```typescript
    // 前端处理
    const accountsText = formData.allowed_accounts; // 多行文本 "123\n456\n789"
    const accountsArray = accountsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    // 发送给后端(后端会转为 JSON 字符串)
    await fetch('/api/admin/features', {
      body: JSON.stringify({
        ...featureDefinition,
        allowed_accounts: accountsArray
      })
    });
    ```
  - 调用 `POST /api/admin/features` (新增) 或 `PUT /api/admin/features/:featureId` (编辑)
  - 处理 400 错误(显示 JSON 校验错误路径)
- "预览"按钮:在侧边栏预览动态表单渲染效果

### 4.3 路由守卫
- 在 middleware.ts 中增加逻辑:
  - 访问 `/admin/*` 路径时检查 authStore.user.role
  - 如果不是 admin,重定向到 `/workspace`

**验收标准**:
- 管理员能新增/编辑/删除功能卡片
- JSON 编辑器有语法高亮、自动补全、格式化功能
- JSON 编辑器实时显示语法错误
- allowed_accounts 文本框与 JSONEditor 的校验提示更严格(保存前格式化为 JSON 数组)
- 切换 is_enabled 开关后,前端工作台立即生效(刷新后可见)
- 预览功能能正确渲染动态表单
- quota_cost=0 且开启时显示红色警告二次确认
- 非 admin 用户无法访问 `/admin/*` 路径

**禁止事项**:
- 禁止允许非 admin 角色访问管理后台
- 禁止在 JSON 编辑器中保存无效 JSON

**依赖项**:
- 后端所有 admin 接口已实现
- authStore 中包含 user.role 字段

---

## 任务5:素材库页面

**产出物**:
- `frontend/src/app/library/page.tsx` (新增)
- `frontend/src/components/AssetCard.tsx` (新增)

**执行内容**:
- 调用 `GET /api/assets?userId=me` 获取用户素材库
- 按时间倒序展示素材卡片
- 素材卡片显示:
  - 缩略图(图片) 或 封面帧(视频)
  - 素材类型标签(图片/视频/压缩包/文本)
  - 创建时间
  - 来源功能名称(feature.display_name)
  - 操作按钮:下载、删除(默认仅删 DB,可选同时删 COS)、复制URL
- 支持筛选:
  - 按素材类型筛选(全部/图片/视频/其他)
  - 按来源功能筛选(下拉列表)
  - 按时间范围筛选
- 支持搜索(按素材ID或功能名称)
- 支持批量下载(多选素材后打包下载)
- 删除素材时二次确认:
  ```typescript
  const deleteAsset = async (assetId: string) => {
    const deleteCosFile = await confirm(
      '是否同时删除云端文件?(建议保留)',
      { defaultValue: false }
    );
    
    await fetch(`/api/assets/${assetId}`, {
      method: 'DELETE',
      body: JSON.stringify({ delete_cos_file: deleteCosFile })
    });
  };
  ```

**验收标准**:
- 素材库能正确展示所有自动保存的任务结果
- 视频素材显示封面帧,不自动播放
- 点击素材卡片可放大查看/播放
- 删除素材时二次确认(默认仅删 DB 记录)
- 删除素材后立即从列表移除
- 复制URL后显示"已复制"提示

**禁止事项**:
- 禁止展示其他用户的素材
- 禁止允许用户上传素材到素材库(素材库只能由系统自动写入)

**依赖项**:
- 后端 GET /api/assets 接口已实现
- 后端 DELETE /api/assets/:assetId 接口已实现

---

## 任务6:导航栏和路由配置

**产出物**:
- `frontend/src/app/layout.tsx` (改造)
- `frontend/src/components/Navigation.tsx` (改造)

**执行内容**:
- 在导航栏增加"素材库"入口,路径 `/library`
- 根据用户角色显示/隐藏"管理后台"入口:
  - 如果 user.role=admin,显示"管理后台"菜单项,路径 `/admin/features`
  - 普通用户不显示
- 导航栏菜单项:
  - 工作台 (`/workspace`)
  - 任务历史 (`/task/history`)
  - 素材库 (`/library`)
  - 会员中心 (`/membership`)
  - 管理后台 (`/admin/features`,仅 admin 可见)

**验收标准**:
- 导航栏菜单根据用户角色动态调整
- 当前页面的菜单项高亮显示
- 移动端导航栏可折叠

**禁止事项**:
- 禁止向普通用户显示管理后台入口

**依赖项**:
- authStore 中包含 user.role 字段

---

## 依赖规范

### 与后端接口契约
1. **权限过滤在后端完成**: 前端调用 `GET /api/features` 时,后端已根据用户套餐和白名单过滤,前端直接展示返回的卡片列表,不做二次过滤
2. **配额信息由后端提供**: 前端不计算配额,所有配额相关信息(剩余配额、消耗配额)从接口响应中获取
3. **表单schema动态渲染**: 前端不写死任何功能的表单,完全根据 form_schema 动态渲染
4. **不展示内部字段**: 所有响应中的内部字段(vendorTaskId、provider_ref、credentials 等)不得在前端展示
5. **HTTP 语义分明**: 402(配额不足) / 403(权限不足) / 429(限流) 统一做 toast + 引导(充值/升级/稍后再试)

### 安全要求
1. **路由守卫**: 所有 `/admin/*` 路径必须在 middleware 中校验 admin 角色
2. **敏感信息**: 不在前端代码中硬编码任何密钥、域名、COS桶名
3. **用户隔离**: 素材库、任务历史只能查看当前登录用户的数据

### 性能要求
1. **轮询优化**: 任务详情页轮询时使用指数退避策略,processing 状态超过5分钟后降低轮询频率(固化常量: INITIAL_INTERVAL=3s, BACKOFF_MAX=20s, MAX_POLLING_DURATION=15min)
2. **图片懒加载**: 素材库和九宫格展示时使用懒加载
3. **JSON编辑器**: 大型 JSON (超过1000行) 时启用虚拟滚动

### 交付标准
- 所有页面必须支持响应式布局(移动端/平板/桌面)
- 所有表单必须有 loading 状态和错误提示
- 所有异步操作必须有 loading 指示器
- 所有用户操作(删除、切换开关等)必须有二次确认或 toast 提示
