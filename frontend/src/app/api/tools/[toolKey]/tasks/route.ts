/**
 * PAGE-P1-STUDIO-101 AI工具任务API
 * 艹，这个API必须稳定，支持任务创建、进度查询、SSE推送！
 *
 * @author 老王
 */

import { NextRequest, NextResponse } from 'next/server';

// 全局任务存储（实际应用中应该使用数据库）
declare global {
  var tasks: Map<string, any> | undefined;
}

// 初始化任务存储
if (!global.tasks) {
  global.tasks = new Map();
}
const tasks = global.tasks;

// 工具配置
const toolConfigs: Record<string, any> = {
  product_shoot: {
    name: '商品图生成',
    estimatedTime: 8000, // 预计时间(ms)
    steps: [
      { progress: 10, message: '分析商品特征...', duration: 1000 },
      { progress: 25, message: '选择拍摄场景...', duration: 1500 },
      { progress: 50, message: 'AI生成图像中...', duration: 3000 },
      { progress: 80, message: '图像后处理...', duration: 2000 },
      { progress: 100, message: '生成完成！', duration: 500 }
    ]
  },
  recolor: {
    name: '服装换色',
    estimatedTime: 6000,
    steps: [
      { progress: 10, message: '识别服装区域...', duration: 800 },
      { progress: 30, message: '应用颜色变换...', duration: 2000 },
      { progress: 70, message: '保持纹理细节...', duration: 2000 },
      { progress: 100, message: '换色完成！', duration: 1200 }
    ]
  },
  ai_tryon: {
    name: 'AI试衣',
    estimatedTime: 15000,
    steps: [
      { progress: 5, message: '分析人物特征...', duration: 1000 },
      { progress: 15, message: '识别服装类型...', duration: 1500 },
      { progress: 30, message: '匹配体型数据...', duration: 2000 },
      { progress: 50, message: 'AI虚拟试穿中...', duration: 4000 },
      { progress: 75, message: '细节优化处理...', duration: 3000 },
      { progress: 90, message: '质量增强处理...', duration: 2000 },
      { progress: 100, message: '试衣完成！', duration: 1500 }
    ]
  },
  dewrinkle: {
    name: '服装去皱',
    estimatedTime: 6000,
    steps: [
      { progress: 10, message: '识别褶皱区域...', duration: 800 },
      { progress: 30, message: '分析纹理结构...', duration: 1200 },
      { progress: 60, message: '智能去皱处理...', duration: 2000 },
      { progress: 85, message: '边缘平滑处理...', duration: 1200 },
      { progress: 100, message: '去皱完成！', duration: 800 }
    ]
  },
  cutout: {
    name: '智能抠图',
    estimatedTime: 10000,
    steps: [
      { progress: 5, message: '分析图像内容...', duration: 600 },
      { progress: 15, message: '识别主体轮廓...', duration: 1400 },
      { progress: 40, message: 'AI抠图处理...', duration: 3000 },
      { progress: 70, message: '边缘羽化处理...', duration: 2000 },
      { progress: 90, message: '细节优化处理...', duration: 1500 },
      { progress: 100, message: '抠图完成！', duration: 1500 }
    ]
  }
};

// 创建任务
export async function POST(
  request: NextRequest,
  { params }: { params: { toolKey: string } }
) {
  try {
    const { toolKey } = params;
    const body = await request.json();
    const { parameters, files, ...otherData } = body;

    // 验证工具是否存在
    const toolConfig = toolConfigs[toolKey];
    if (!toolConfig) {
      return NextResponse.json(
        { error: `Unknown tool: ${toolKey}` },
        { status: 400 }
      );
    }

    // 生成任务ID
    const taskId = `task_${toolKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 创建任务记录
    const task = {
      id: taskId,
      toolKey,
      parameters,
      files,
      status: 'pending',
      progress: 0,
      message: '任务已创建',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null
    };

    tasks.set(taskId, task);

    console.log(`Created task: ${taskId} for tool: ${toolKey}`);

    // 异步开始处理任务
    processTask(taskId, toolConfig);

    return NextResponse.json({
      taskId,
      status: 'created',
      message: 'Task created successfully'
    });

  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

// 处理任务
async function processTask(taskId: string, toolConfig: any) {
  const task = tasks.get(taskId);
  if (!task) return;

  try {
    // 更新任务状态为处理中
    task.status = 'processing';
    task.startedAt = new Date().toISOString();
    tasks.set(taskId, task);

    // 模拟处理步骤
    for (const step of toolConfig.steps) {
      await new Promise(resolve => setTimeout(resolve, step.duration));

      task.progress = step.progress;
      task.message = step.message;
      tasks.set(taskId, task);

      console.log(`Task ${taskId} progress: ${step.progress}% - ${step.message}`);
    }

    // 生成模拟结果
    const result = await generateMockResult(task.toolKey, task.parameters, task.files);

    // 任务完成
    task.status = 'completed';
    task.progress = 100;
    task.message = '任务完成';
    task.completedAt = new Date().toISOString();
    task.result = result;

    tasks.set(taskId, task);

    console.log(`Task ${taskId} completed with ${result.images.length} images`);

  } catch (error) {
    console.error(`Task ${taskId} failed:`, error);
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : 'Unknown error';
    task.completedAt = new Date().toISOString();
    tasks.set(taskId, task);
  }
}

// 生成模拟结果
async function generateMockResult(toolKey: string, parameters: any, files: string[]) {
  let images: string[] = [];
  let metadata: any = {
    toolKey,
    parameters,
    inputFiles: files,
    generatedAt: new Date().toISOString()
  };

  switch (toolKey) {
    case 'product_shoot':
      const count = parameters?.count || 4;
      for (let i = 0; i < count; i++) {
        const seed = Date.now() + Math.random();
        images.push(`https://picsum.photos/512/512?random=${seed}&blur=${Math.random() > 0.8 ? '1' : '0'}`);
      }
      metadata.totalImages = count;
      break;

    case 'recolor':
      const recolorSeed = Date.now() + Math.random();
      images.push(`https://picsum.photos/512/512?random=${recolorSeed}`);
      metadata.colorEffect = parameters?.color || '#1E3A8A';
      metadata.totalImages = 1;
      break;

    case 'ai_tryon':
      // AI试衣需要生成一张试衣结果图
      const tryonSeed = Date.now() + Math.random();
      images.push(`https://picsum.photos/400/600?random=${tryonSeed}`);

      // 保存原始服装图片用于对比
      if (files && files.length > 1) {
        metadata.originalImage = files[1]; // 第二个文件是服装图片
      }

      metadata.bodyType = parameters?.body_type || 'standard';
      metadata.height = parameters?.height || 170;
      metadata.weight = parameters?.weight || 60;
      metadata.occlusionLevel = parameters?.occlusion_level || 'light';
      metadata.totalImages = 1;
      break;

    case 'dewrinkle':
      // 服装去皱生成一张平滑后的图片
      const dewrinkleSeed = Date.now() + Math.random();
      images.push(`https://picsum.photos/512/512?random=${dewrinkleSeed}&blur=${Math.random() > 0.7 ? '1' : '0'}`);

      metadata.intensity = parameters?.intensity || 0.6;
      metadata.contrast = parameters?.contrast || 1.2;
      metadata.preserveTexture = parameters?.preserve_texture || 'medium';
      metadata.artifactControl = parameters?.artifact_control || 'balanced';
      metadata.totalImages = 1;
      break;

    case 'cutout':
      // 智能抠图生成一张结果图和一张缩略图
      const cutoutSeed = Date.now() + Math.random();
      images.push(`https://picsum.photos/600/800?random=${cutoutSeed}`);

      // 生成缩略图
      const thumbnailSeed = Date.now() + Math.random();
      images.push(`https://picsum.photos/200/200?random=${thumbnailSeed}`);

      metadata.mode = parameters?.mode || 'person';
      metadata.featherRadius = parameters?.feather_radius || 2;
      metadata.edgeAlgorithm = parameters?.edge_algorithm || 'smooth';
      metadata.backgroundType = parameters?.background_type || 'transparent';
      metadata.backgroundColor = parameters?.background_color || '#FFFFFF';
      metadata.totalImages = 2; // 主图 + 缩略图
      break;

    default:
      const defaultSeed = Date.now() + Math.random();
      images.push(`https://picsum.photos/512/512?random=${defaultSeed}`);
      metadata.totalImages = 1;
  }

  return {
    images,
    metadata
  };
}

// 获取任务状态
export async function GET(
  request: NextRequest,
  { params }: { params: { toolKey: string } }
) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { error: 'taskId is required' },
      { status: 400 }
    );
  }

  const task = tasks.get(taskId);
  if (!task) {
    return NextResponse.json(
      { error: 'Task not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(task);
}