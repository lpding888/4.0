/**
 * 初始化功能定义数据
 * 艹！包括form schemas、pipeline schemas和feature definitions！
 */

exports.seed = async function(knex) {
  // 1. 清空现有数据
  await knex('feature_definitions').del();
  await knex('form_schemas').del();
  await knex('pipeline_schemas').del();

  // 2. 插入Form Schemas
  await knex('form_schemas').insert([
    {
      schema_id: 'basic_clean_form',
      fields: JSON.stringify([
        {
          field_name: 'inputImage',
          field_type: 'image',
          label: '上传服装图片',
          required: true,
          validation: {
            maxSize: 10485760,  // 10MB
            allowedFormats: ['jpg', 'jpeg', 'png', 'webp']
          },
          mapping: {
            target: 'inputImageUrl',
            transform: 'cosUrl'
          }
        }
      ])
    },
    {
      schema_id: 'model_pose12_form',
      fields: JSON.stringify([
        {
          field_name: 'inputImage',
          field_type: 'image',
          label: '上传服装图片',
          required: true,
          validation: {
            maxSize: 10485760,  // 10MB
            allowedFormats: ['jpg', 'jpeg', 'png', 'webp']
          },
          mapping: {
            target: 'inputImageUrl',
            transform: 'cosUrl'
          }
        },
        {
          field_name: 'modelGender',
          field_type: 'radio',
          label: '模特性别',
          required: true,
          options: [
            { value: 'male', label: '男' },
            { value: 'female', label: '女' }
          ],
          default: 'female',
          mapping: {
            target: 'params.modelGender'
          }
        }
      ])
    }
  ]);

  // 3. 插入Pipeline Schemas
  await knex('pipeline_schemas').insert([
    {
      pipeline_id: 'basic_clean_pipeline',
      steps: JSON.stringify([
        {
          step_id: 'image_clean',
          step_type: 'sync',
          provider: 'tencent_ci',
          action: 'background_removal',
          timeout: 30000,
          retry: {
            max_attempts: 2,
            delay: 1000
          }
        }
      ])
    },
    {
      pipeline_id: 'model_pose12_pipeline',
      steps: JSON.stringify([
        {
          step_id: 'ai_model_generation',
          step_type: 'async',
          provider: 'runninghub',
          action: 'model_pose_12',
          timeout: 180000,
          retry: {
            max_attempts: 3,
            delay: 5000
          },
          polling: {
            interval: 10000,
            max_duration: 300000
          }
        }
      ])
    }
  ]);

  // 4. 插入Feature Definitions
  await knex('feature_definitions').insert([
    {
      feature_id: 'basic_clean',
      display_name: '基础抠图',
      category: '基础处理',
      description: '快速去除图片背景，生成透明底或白底商品图',
      is_enabled: true,
      plan_required: 'free',
      access_scope: 'plan',
      quota_cost: 1,
      rate_limit_policy: 'hourly:30',
      output_type: 'image',
      save_to_asset_library: true,
      form_schema_ref: 'basic_clean_form',
      pipeline_schema_ref: 'basic_clean_pipeline'
    },
    {
      feature_id: 'model_pose12',
      display_name: 'AI模特上身',
      category: 'AI模特',
      description: '智能生成12张AI模特穿搭效果图，多角度展示',
      is_enabled: true,
      plan_required: 'member',
      access_scope: 'plan',
      quota_cost: 1,
      rate_limit_policy: 'hourly:10',
      output_type: 'multiImage',
      save_to_asset_library: true,
      form_schema_ref: 'model_pose12_form',
      pipeline_schema_ref: 'model_pose12_pipeline'
    }
  ]);

  console.log('✓ 功能定义数据初始化完成！');
};
