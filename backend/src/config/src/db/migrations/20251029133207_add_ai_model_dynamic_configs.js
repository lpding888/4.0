/**
 * AI模特服务动态配置迁移
 *
 * 老王我把所有硬编码的配置都移到数据库里，再也不用改代码了！
 *
 * 配置项:
 * 1. RunningHub工作流配置 (webappId, 节点映射)
 * 2. AI模特Prompt模板 (3个场景 × 3个品类 = 9个模板)
 */
exports.up = async function(knex) {
  // 插入RunningHub工作流配置
  await knex('system_configs').insert([
    {
      config_key: 'runninghub_webapp_id',
      config_value: JSON.stringify('1982694711750213634'),
      description: 'RunningHub工作流ID - AI模特12分镜生成',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      config_key: 'runninghub_node_prompt',
      config_value: JSON.stringify('103'),
      description: 'RunningHub节点ID - 输入Prompt文本',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      config_key: 'runninghub_node_image',
      config_value: JSON.stringify('74'),
      description: 'RunningHub节点ID - 输入参考图片',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);

  // 插入AI模特Prompt模板配置
  const promptTemplates = [
    // 街拍场景
    {
      config_key: 'ai_model_prompt_street_shoes',
      config_value: JSON.stringify('这是一个模特拍摄，鞋子为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为街拍风格，不同运镜和角度，不同的视角和景别'),
      description: 'AI模特Prompt模板 - 街拍场景/鞋子品类',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      config_key: 'ai_model_prompt_street_dress',
      config_value: JSON.stringify('这是一个模特拍摄，连衣裙为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为街拍风格，不同运镜和角度，不同的视角和景别'),
      description: 'AI模特Prompt模板 - 街拍场景/连衣裙品类',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      config_key: 'ai_model_prompt_street_hoodie',
      config_value: JSON.stringify('这是一个模特拍摄，卫衣为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为街拍风格，不同运镜和角度，不同的视角和景别'),
      description: 'AI模特Prompt模板 - 街拍场景/卫衣品类',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // 白棚场景
    {
      config_key: 'ai_model_prompt_studio_shoes',
      config_value: JSON.stringify('这是一个模特拍摄，鞋子为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为白棚摄影棚，不同运镜和角度，不同的视角和景别'),
      description: 'AI模特Prompt模板 - 白棚场景/鞋子品类',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      config_key: 'ai_model_prompt_studio_dress',
      config_value: JSON.stringify('这是一个模特拍摄，连衣裙为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为白棚摄影棚，不同运镜和角度，不同的视角和景别'),
      description: 'AI模特Prompt模板 - 白棚场景/连衣裙品类',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      config_key: 'ai_model_prompt_studio_hoodie',
      config_value: JSON.stringify('这是一个模特拍摄，卫衣为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为白棚摄影棚，不同运镜和角度，不同的视角和景别'),
      description: 'AI模特Prompt模板 - 白棚场景/卫衣品类',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // 室内场景
    {
      config_key: 'ai_model_prompt_indoor_shoes',
      config_value: JSON.stringify('这是一个模特拍摄，鞋子为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为室内居家环境，不同运镜和角度，不同的视角和景别'),
      description: 'AI模特Prompt模板 - 室内场景/鞋子品类',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      config_key: 'ai_model_prompt_indoor_dress',
      config_value: JSON.stringify('这是一个模特拍摄，连衣裙为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为室内居家环境，不同运镜和角度，不同的视角和景别'),
      description: 'AI模特Prompt模板 - 室内场景/连衣裙品类',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      config_key: 'ai_model_prompt_indoor_hoodie',
      config_value: JSON.stringify('这是一个模特拍摄，卫衣为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为室内居家环境，不同运镜和角度，不同的视角和景别'),
      description: 'AI模特Prompt模板 - 室内场景/卫衣品类',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ];

  await knex('system_configs').insert(promptTemplates);
};

/**
 * 回滚: 删除AI模特相关的所有配置
 */
exports.down = async function(knex) {
  await knex('system_configs')
    .whereIn('config_key', [
      'runninghub_webapp_id',
      'runninghub_node_prompt',
      'runninghub_node_image',
      'ai_model_prompt_street_shoes',
      'ai_model_prompt_street_dress',
      'ai_model_prompt_street_hoodie',
      'ai_model_prompt_studio_shoes',
      'ai_model_prompt_studio_dress',
      'ai_model_prompt_studio_hoodie',
      'ai_model_prompt_indoor_shoes',
      'ai_model_prompt_indoor_dress',
      'ai_model_prompt_indoor_hoodie'
    ])
    .delete();
};
