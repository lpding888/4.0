/**
 * Swagger API文档配置
 */

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'AI照片处理后端API',
    version: '1.0.0',
    description: `
      AI照片处理后端API文档

      ## 功能特性
      - 用户认证和授权
      - 任务创建和管理
      - 图像处理和AI模型
      - 实时进度推送
      - 文件存储管理
      - 系统监控和维护

      ## 认证方式
      API使用JWT Bearer Token认证：
      \`\`\`
      Authorization: Bearer <token>
      \`\`\`

      ## 错误响应格式
      所有API错误响应都遵循统一格式：
      \`\`\`
      {
        "success": false,
        "error": {
          "code": "ERROR_CODE",
          "message": "错误描述"
        },
        "timestamp": "2025-01-03T16:56:00.000Z"
      }
      \`\`\`

      ## WebSocket连接
      WebSocket端点：\`ws://localhost:3001\`

      连接后需要发送认证消息：
      \`\`\`
      {
        "type": "auth",
        "data": {
          "token": "your-jwt-token"
        }
      }
      \`\`\`

      ## 限流说明
      - API请求：100次/分钟/用户
      - WebSocket连接：10个并发连接/用户
    `,
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: process.env.NODE_ENV === 'production'
        ? 'https://api.example.com'
        : `http://localhost:${process.env.PORT || 3000}`,
      description: process.env.NODE_ENV === 'production'
        ? '生产环境'
        : '开发环境'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT访问令牌'
      },
      apiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API密钥认证（系统间调用）'
      }
    },
    schemas: {
      // 响应格式
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object',
            description: '响应数据'
          },
          error: {
            $ref: '#/components/schemas/Error'
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-03T16:56:00.000Z'
          }
        },
        required: ['success', 'timestamp']
      },

      Error: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            example: 'VALIDATION_ERROR'
          },
          message: {
            type: 'string',
            example: '请求参数验证失败'
          },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  example: 'email'
                },
                message: {
                  type: 'string',
                  example: '邮箱格式不正确'
                },
                value: {
                  type: 'string',
                  example: 'invalid-email'
                }
              }
            }
          }
        },
        required: ['code', 'message']
      },

      // 用户相关
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '550e8400-e29b-41d4-a716-446655440000'
          },
          email: {
            type: 'string',
            format: 'email',
            example: 'user@example.com'
          },
          username: {
            type: 'string',
            example: 'testuser'
          },
          role: {
            type: 'string',
            enum: ['user', 'admin', 'system'],
            example: 'user'
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'banned'],
            example: 'active'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-03T16:56:00.000Z'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            example: '2025-01-03T16:56:00.000Z'
          }
        }
      },

      // 任务相关
      Task: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'task_12345678'
          },
          type: {
            type: 'string',
            enum: ['basic_clean', 'enhance', 'background_remove', 'model_pose12', 'ai_enhance', 'ai_generate'],
            example: 'basic_clean'
          },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'success', 'failed'],
            example: 'processing'
          },
          imageUrl: {
            type: 'string',
            format: 'uri',
            example: 'https://example.com/image.jpg'
          },
          resultUrls: {
            type: 'array',
            items: {
              type: 'string'
            },
            example: ['https://example.com/result.jpg']
          },
          progress: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            example: 50
          },
          userId: {
            type: 'string',
            example: '550e8400-e29b-41d4-a716-446655440000'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },

      // 请求参数
      CreateTaskRequest: {
        type: 'object',
        required: ['type', 'imageUrl'],
        properties: {
          type: {
            type: 'string',
            enum: ['basic_clean', 'enhance', 'background_remove', 'model_pose12', 'ai_enhance', 'ai_generate']
          },
          imageUrl: {
            type: 'string',
            format: 'uri'
          },
          params: {
            type: 'object',
            description: '处理参数，根据任务类型不同'
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high'],
            default: 'normal'
          }
        }
      },

      PaginationQuery: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 20
          },
          cursor: {
            type: 'string',
            description: '游标分页标记'
          },
          sort: {
            type: 'string',
            enum: ['created_at', 'updated_at', 'status', 'type'],
            default: 'created_at'
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc'
          }
        }
      },

      PaginatedResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean'
          },
          data: {
            type: 'array',
            items: {
              type: 'object'
            }
          },
          pagination: {
            type: 'object',
            properties: {
              limit: {
                type: 'integer'
              },
              cursor: {
                type: 'string'
              },
              hasMore: {
                type: 'boolean'
              },
              nextCursor: {
                type: 'string'
              }
            }
          },
          total: {
            type: 'integer'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },

      // WebSocket消息
      WebSocketMessage: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['auth', 'ping', 'pong', 'task_progress', 'task_status_changed', 'notification', 'chat_message']
          },
          data: {
            type: 'object'
          },
          id: {
            type: 'string',
            description: '消息ID，用于响应关联'
          }
        },
        required: ['type', 'data']
      },

      TaskProgressMessage: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            example: 'task_progress'
          },
          data: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                example: 'task_12345678'
              },
              percentage: {
                type: 'integer',
                minimum: 0,
                maximum: 100,
                example: 50
              },
              currentStep: {
                type: 'string',
                example: '图像增强处理'
              },
              message: {
                type: 'string',
                example: '正在处理第2步，共5步'
              },
              eta: {
                type: 'integer',
                description: '预计剩余时间（秒）',
                example: 30
              }
            }
          }
        }
      },

      // 通知相关
      Notification: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          type: {
            type: 'string',
            enum: ['task_completed', 'task_failed', 'quota_low', 'system_maintenance', 'payment_success', 'payment_failed', 'membership_expired', 'promotion']
          },
          title: {
            type: 'string',
            example: '任务完成通知'
          },
          message: {
            type: 'string',
            example: '您的图像处理任务已成功完成'
          },
          read: {
            type: 'boolean',
            default: false
          },
          data: {
            type: 'object',
            description: '附加数据'
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
            default: 'normal'
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          }
        }
      },

      // 微信登录相关
      WechatOAuthResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean'
          },
          data: {
            type: 'object',
            properties: {
              authUrl: {
                type: 'string',
                description: '微信授权URL'
              },
              state: {
                type: 'string',
                description: '状态参数'
              }
            }
          },
          message: {
            type: 'string'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },

      WechatLoginResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean'
          },
          data: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string'
                  },
                  username: {
                    type: 'string'
                  },
                  email: {
                    type: 'string'
                  },
                  role: {
                    type: 'string'
                  },
                  isMember: {
                    type: 'boolean'
                  },
                  quota_remaining: {
                    type: 'integer'
                  },
                  wechat_nickname: {
                    type: 'string'
                  },
                  wechat_avatar: {
                    type: 'string'
                  }
                }
              },
              tokens: {
                type: 'object',
                properties: {
                  accessToken: {
                    type: 'string'
                  },
                  refreshToken: {
                    type: 'string'
                  },
                  expiresIn: {
                    type: 'integer'
                  },
                  tokenType: {
                    type: 'string'
                  }
                }
              },
              isNewUser: {
                type: 'boolean'
              },
              platform: {
                type: 'string',
                enum: ['officialAccount', 'miniProgram', 'openPlatform']
              }
            }
          },
          message: {
            type: 'string'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      },

      WechatMiniProgramLoginRequest: {
        type: 'object',
        required: ['code'],
        properties: {
          code: {
            type: 'string',
            description: '小程序登录凭证'
          },
          userInfo: {
            type: 'object',
            description: '用户信息',
            properties: {
              nickName: {
                type: 'string'
              },
              avatarUrl: {
                type: 'string'
              },
              gender: {
                type: 'integer'
              },
              city: {
                type: 'string'
              },
              province: {
                type: 'string'
              },
              country: {
                type: 'string'
              }
            }
          }
        }
      },

      WechatBindingInfo: {
        type: 'object',
        properties: {
          openid: {
            type: 'string'
          },
          unionid: {
            type: 'string'
          },
          nickname: {
            type: 'string'
          },
          avatar: {
            type: 'string'
          },
          lastLoginPlatform: {
            type: 'string'
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    },
    {
      apiKeyAuth: []
    }
  ],
  tags: [
    {
      name: '认证',
      description: '用户认证相关接口'
    },
    {
      name: '微信登录',
      description: '微信登录相关接口'
    },
    {
      name: '任务',
      description: '任务管理相关接口'
    },
    {
      name: '用户',
      description: '用户管理相关接口'
    },
    {
      name: '功能',
      description: '功能配置相关接口'
    },
    {
      name: '文件',
      description: '文件管理相关接口'
    },
    {
      name: '通知',
      description: '通知管理相关接口'
    },
    {
      name: '支付',
      description: '支付相关接口'
    },
    {
      name: '管理',
      description: '管理员专用接口'
    },
    {
      name: '系统',
      description: '系统监控和配置接口'
    },
    {
      name: 'WebSocket',
      description: 'WebSocket实时通信接口'
    }
  ]
};

module.exports = swaggerDefinition;