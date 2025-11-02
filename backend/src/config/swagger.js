const swaggerJsdoc = require('swagger-jsdoc');

/**
 * Swagger配置 (P1-013)
 * 艹！为所有API生成OpenAPI 3.0文档
 */
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AI Photo API',
      version: '1.0.0',
      description: 'AI照片处理平台API文档 - 艹！所有接口一目了然',
      contact: {
        name: '老王',
        email: 'support@ai-photo.com'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3001',
        description: '开发环境'
      },
      {
        url: 'https://api.ai-photo.com',
        description: '生产环境'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT认证 - 请在请求头中携带 Authorization: Bearer {token}'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            errorCode: {
              type: 'integer',
              example: 1000
            },
            message: {
              type: 'string',
              example: '系统错误'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'user_123456'
            },
            phone: {
              type: 'string',
              example: '13800138000'
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              example: 'user'
            },
            isMember: {
              type: 'boolean',
              example: false
            },
            quota_remaining: {
              type: 'integer',
              example: 100
            },
            quota_expireAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            nickname: {
              type: 'string',
              nullable: true,
              example: '老王'
            },
            avatar: {
              type: 'string',
              nullable: true,
              example: 'https://cdn.example.com/avatar.jpg'
            },
            gender: {
              type: 'string',
              enum: ['male', 'female', 'other', 'unknown'],
              example: 'male'
            }
          }
        },
        Task: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'task_1234567890'
            },
            user_id: {
              type: 'string',
              example: 'user_123456'
            },
            feature_id: {
              type: 'string',
              example: 'basic_retouch'
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'completed', 'failed'],
              example: 'processing'
            },
            progress: {
              type: 'integer',
              example: 50
            },
            input_data: {
              type: 'object'
            },
            output_data: {
              type: 'object',
              nullable: true
            },
            error_message: {
              type: 'string',
              nullable: true
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            updated_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Order: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'order_1234567890'
            },
            user_id: {
              type: 'string',
              example: 'user_123456'
            },
            order_type: {
              type: 'string',
              enum: ['membership', 'quota'],
              example: 'membership'
            },
            amount: {
              type: 'integer',
              example: 9900
            },
            status: {
              type: 'string',
              enum: ['pending', 'paid', 'cancelled', 'refunded'],
              example: 'pending'
            },
            payment_method: {
              type: 'string',
              enum: ['wechat', 'alipay'],
              example: 'wechat'
            },
            payment_info: {
              type: 'object'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: '认证相关接口 - 登录、注册、验证码'
      },
      {
        name: 'User',
        description: '用户相关接口 - 个人信息、配额管理'
      },
      {
        name: 'Task',
        description: '任务相关接口 - 创建任务、查询任务'
      },
      {
        name: 'Payment',
        description: '支付相关接口 - 创建订单、支付回调'
      },
      {
        name: 'Distribution',
        description: '分销相关接口 - 分销员管理、佣金提现'
      },
      {
        name: 'Admin',
        description: '管理员接口 - 用户管理、系统配置'
      }
    ]
  },
  apis: [
    './src/routes/*.js', // 扫描所有路由文件中的Swagger注释
    './src/controllers/*.js' // 扫描所有控制器文件中的Swagger注释
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
