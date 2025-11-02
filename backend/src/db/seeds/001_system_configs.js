/**
 * 系统配置种子数据
 */

exports.seed = async function(knex) {
  // 清空现有配置
  await knex('system_configs').del();

  // 基础系统配置
  const basicConfigs = [
    // API配置
    {
      config_key: 'tencent_secret_id',
      config_value: process.env.TENCENT_SECRET_ID || '',
      config_type: 'secret',
      category: 'api',
      description: '腾讯云SecretID',
      is_secret: true,
      is_system: true,
      sort_order: 1
    },
    {
      config_key: 'tencent_secret_key',
      config_value: process.env.TENCENT_SECRET_KEY || '',
      config_type: 'secret',
      category: 'api',
      description: '腾讯云SecretKey',
      is_secret: true,
      is_system: true,
      sort_order: 2
    },
    {
      config_key: 'hunyuan_api_key',
      config_value: process.env.HUNYUAN_API_KEY || '',
      config_type: 'secret',
      category: 'api',
      description: '混元大模型API密钥',
      is_secret: true,
      is_system: true,
      sort_order: 3
    },
    {
      config_key: 'hunyuan_api_secret',
      config_value: process.env.HUNYUAN_API_SECRET || '',
      config_type: 'secret',
      category: 'api',
      description: '混元大模型API密钥',
      is_secret: true,
      is_system: true,
      sort_order: 4
    },
    {
      config_key: 'kuai_api_key',
      config_value: process.env.KUAI_API_KEY || '',
      config_type: 'secret',
      category: 'api',
      description: 'KUAI快影API密钥',
      is_secret: true,
      is_system: true,
      sort_order: 5
    },
    {
      config_key: 'runninghub_api_key',
      config_value: process.env.RUNNINGHUB_API_KEY || '',
      config_type: 'secret',
      category: 'api',
      description: 'RunningHub API密钥',
      is_secret: true,
      is_system: true,
      sort_order: 6
    },

    // 业务配置
    {
      config_key: 'plan_monthly_quota',
      config_value: process.env.PLAN_MONTHLY_QUOTA || '100',
      config_type: 'number',
      category: 'business',
      description: '会员月度配额',
      is_secret: false,
      is_system: false,
      sort_order: 10
    },
    {
      config_key: 'membership_price',
      config_value: process.env.MEMBERSHIP_PRICE || '9900',
      config_type: 'number',
      category: 'business',
      description: '会员价格(分)',
      is_secret: false,
      is_system: false,
      sort_order: 11
    },

    // 提示词配置
    {
      config_key: 'video_shooting_prompt_template',
      config_value: JSON.stringify({
        template: `你是一个专业的服装视频拍摄导演，请为以下服装生成专业的拍摄脚本。

服装图片: {{imageUrl}}
服装类型: {{clothingType}}
拍摄要求: {{requirements}}

请按照以下格式生成拍摄脚本:

[镜头1] 开场镜头：简洁介绍服装和品牌风格
[镜头2] 主体展示：模特穿着该服装走动、转身、展示
[镜头3] 细节特写：服装细节、面料、工艺等的特写
[镜头4] 结束镜头：最终效果展示和品牌形象传达

内容要素要求：
- 服装类型识别：根据图片识别是上衣/裙子/裤子等
- 动作设计：符合服装特点和风格的自然动作
- 运镜方式：专业的摄影机运动（推拉摇移跟升降）
- 灯光设置：与服装风格相匹配的灯光搭配
- 背景氛围：专业级别的商业展示背景
- 音乐建议：适合的背景音乐类型和节奏

脚本要求：
- 总长度：200-300字
- 语言：中文描述
- 风格：专业、具体、可执行
- 格式：按镜头分段描述`,
        variables: ['imageUrl', 'clothingType', 'requirements']
      }),
      config_type: 'json',
      category: 'prompt',
      description: '视频拍摄脚本生成提示词模板',
      is_secret: false,
      is_system: false,
      sort_order: 20
    },

    // 系统配置
    {
      config_key: 'system_maintenance_mode',
      config_value: 'false',
      config_type: 'boolean',
      category: 'system',
      description: '系统维护模式开关',
      is_secret: false,
      is_system: true,
      sort_order: 30
    },
    {
      config_key: 'system_notice',
      config_value: '',
      config_type: 'string',
      category: 'system',
      description: '系统公告',
      is_secret: false,
      is_system: false,
      sort_order: 31
    }
  ];

  await knex('system_configs').insert(basicConfigs);
};