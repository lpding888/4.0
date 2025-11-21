/**
 * Provider 配置初始数据
 * 根据实际需求配置各类 Provider
 */

exports.seed = async function (knex) {
  // 清空现有数据（可选，根据需求决定是否删除）
  // await knex('provider_configs').del();

  // 检查是否已有数据
  const existing = await knex('provider_configs').count('* as count').first();
  if (existing && existing.count > 0) {
    console.log('⚠️  provider_configs 已有数据，跳过初始化');
    return;
  }

  console.log('📝 插入 Provider 初始配置...');

  // 插入初始 Provider 配置
  await knex('provider_configs').insert([
    // ========== RunningHub Provider ==========
    {
      provider_id: 'runninghub_main',
      provider_name: 'RunningHub 主服务',
      type: 'runninghub',
      description: 'AI 工作流主服务',
      is_enabled: true,
      priority: 10,
      config: JSON.stringify({
        api_url: 'https://api.runninghub.ai',
        api_key_ref: 'RUNNING_HUB_API_KEY', // 引用环境变量
        workflow_id: 'default_workflow',
        timeout: 30000,
        retry_count: 3,
        features: ['image_generation', 'text_processing']
      }),
      metadata: JSON.stringify({
        provider: 'runninghub',
        version: 'v1',
        region: 'global'
      }),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // ========== 邮件服务 Provider ==========
    {
      provider_id: 'email_smtp_main',
      provider_name: 'SMTP 邮件服务',
      type: 'email',
      description: '邮箱验证码发送服务',
      is_enabled: true,
      priority: 10,
      config: JSON.stringify({
        host: process.env.SMTP_HOST || 'smtp.example.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: true,
        auth: {
          user_ref: 'SMTP_USER',     // 引用环境变量
          pass_ref: 'SMTP_PASSWORD'  // 引用环境变量
        },
        from: {
          name: 'AI衣柜',
          address: process.env.SMTP_FROM || 'noreply@example.com'
        },
        timeout: 10000,
        rate_limit: {
          max_per_hour: 100,
          max_per_day: 1000
        }
      }),
      metadata: JSON.stringify({
        provider: 'smtp',
        version: 'v1'
      }),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // ========== 腾讯云 SCF Provider ==========
    {
      provider_id: 'tencent_scf_main',
      provider_name: '腾讯云云函数',
      type: 'scf',
      description: '图片后处理云函数',
      is_enabled: false, // 默认禁用，需要配置后启用
      priority: 20,
      config: JSON.stringify({
        region: 'ap-guangzhou',
        function_name: 'image-post-process',
        namespace: 'default',
        secret_id_ref: 'COS_SECRET_ID',
        secret_key_ref: 'COS_SECRET_KEY',
        timeout: 60000,
        memory: 512
      }),
      metadata: JSON.stringify({
        provider: 'tencent_cloud',
        service: 'scf',
        version: 'v1'
      }),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },

    // ========== 图片同步处理 Provider ==========
    {
      provider_id: 'image_sync_main',
      provider_name: '同步图片处理',
      type: 'sync_image',
      description: '本地同步图片处理服务',
      is_enabled: true,
      priority: 30,
      config: JSON.stringify({
        max_file_size: 10485760, // 10MB
        allowed_types: ['image/jpeg', 'image/png', 'image/webp'],
        quality: 85,
        max_width: 2048,
        max_height: 2048,
        timeout: 5000
      }),
      metadata: JSON.stringify({
        provider: 'local',
        version: 'v1'
      }),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);

  console.log('✅ Provider 配置初始化完成');
};
