/**
 * PERF-P2-SSR-204: 模板数据获取API
 * 艹!为SSR/ISR准备的服务端数据获取函数,支持缓存和重新验证!
 *
 * @author 老王
 */

import { Template } from '@/components/templates/types';

/**
 * 艹!获取所有模板数据(支持ISR缓存)
 * 这个函数会在服务端执行,支持Next.js的缓存机制
 */
export async function getTemplates(options?: {
  category?: string;
  type?: string;
  revalidate?: number; // ISR重新验证时间(秒)
}): Promise<Template[]> {
  // 艹!这里应该调用真实的API,现在用模拟数据
  // 在真实环境中应该是: const res = await fetch(`${API_URL}/templates`, { next: { revalidate: 60 } })

  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 100));

  // 艹!返回模拟数据(与原page.tsx中的mockTemplates一致)
  const mockTemplates: Template[] = [
    {
      id: 'tpl_001',
      name: '项目计划书模板',
      description: '专业的项目计划书模板,包含项目概述、目标、时间线、资源分配等完整内容。',
      type: 'document',
      category: 'business',
      complexity: 'intermediate',
      tags: ['项目管理', '计划书', '商业'],
      content: '# 项目计划书\n\n## 项目概述\n\n{{projectName}} 是一个 {{projectType}} 项目...',
      thumbnail: 'https://via.placeholder.com/300x200/1890ff/ffffff?text=项目计划书',
      preview: '专业的项目计划书模板,帮助您快速创建完整的项目规划文档...',
      author: {
        id: 'user_001',
        name: '张经理',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=manager'
      },
      createdAt: '2024-10-15T00:00:00Z',
      updatedAt: '2025-11-01T10:30:00Z',
      usageCount: 156,
      rating: 4.8,
      ratingCount: 42,
      isPublic: true,
      isOfficial: true,
      isFavorite: false,
      version: '1.2.0',
      variables: [
        { name: 'projectName', type: 'text', label: '项目名称', required: true, placeholder: '请输入项目名称' },
        { name: 'projectType', type: 'select', label: '项目类型', required: true, options: ['软件开发', '市场营销', '产品设计', '其他'] },
      ]
    },
    {
      id: 'tpl_002',
      name: '代码审查清单',
      description: '全面的代码审查清单,确保代码质量和规范。',
      type: 'code',
      category: 'technical',
      complexity: 'basic',
      tags: ['代码审查', '质量保证', '开发'],
      content: '# 代码审查清单\n\n## 基础检查\n\n- [ ] 代码遵循{{codingStandard}}',
      thumbnail: 'https://via.placeholder.com/300x200/52c41a/ffffff?text=代码审查',
      preview: '全面的代码审查清单,帮助开发团队保证代码质量...',
      author: {
        id: 'user_002',
        name: '李工程师',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=developer'
      },
      createdAt: '2024-09-20T00:00:00Z',
      updatedAt: '2025-10-28T16:45:00Z',
      usageCount: 89,
      rating: 4.6,
      ratingCount: 28,
      isPublic: true,
      isOfficial: false,
      isFavorite: true,
      version: '1.1.0',
    },
    {
      id: 'tpl_003',
      name: '会议纪要模板',
      description: '标准的会议纪要模板,包含参会人员、议题讨论、行动项等。',
      type: 'document',
      category: 'business',
      complexity: 'basic',
      tags: ['会议', '纪要', '办公'],
      content: '# 会议纪要\n\n**会议主题:** {{meetingTitle}}',
      thumbnail: 'https://via.placeholder.com/300x200/faad14/ffffff?text=会议纪要',
      preview: '标准的会议纪要模板,帮助您高效记录和整理会议内容...',
      author: {
        id: 'user_003',
        name: '王助理',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=assistant'
      },
      createdAt: '2024-08-10T00:00:00Z',
      updatedAt: '2025-10-15T14:20:00Z',
      usageCount: 234,
      rating: 4.5,
      ratingCount: 67,
      isPublic: true,
      isOfficial: true,
      isFavorite: false,
      version: '1.0.0',
    }
  ];

  // 艹!根据options过滤数据
  let filtered = mockTemplates;

  if (options?.category && options.category !== 'all') {
    filtered = filtered.filter(t => t.category === options.category);
  }

  if (options?.type && options.type !== 'all') {
    filtered = filtered.filter(t => t.type === options.type);
  }

  return filtered;
}

/**
 * 艹!获取单个模板详情(用于模板详情页SSG)
 */
export async function getTemplateById(id: string): Promise<Template | null> {
  const templates = await getTemplates();
  return templates.find(t => t.id === id) || null;
}

/**
 * 艹!获取模板统计数据(服务端渲染用)
 */
export async function getTemplateStats() {
  const templates = await getTemplates();

  return {
    totalTemplates: templates.length,
    officialTemplates: templates.filter(t => t.isOfficial).length,
    favoriteTemplates: templates.filter(t => t.isFavorite).length,
    totalUsage: templates.reduce((sum, t) => sum + (t.usageCount ?? 0), 0),
  };
}
