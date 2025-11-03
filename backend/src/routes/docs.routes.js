const express = require('express');
const swaggerService = require('../services/swagger.service');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * API文档路由
 */

/**
 * 获取API文档JSON规范
 */
router.get('/swagger.json', (req, res) => {
  try {
    const spec = swaggerService.getSpec();

    if (!spec) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DOCS_NOT_AVAILABLE',
          message: 'API文档不可用'
        }
      });
    }

    res.set('Content-Type', 'application/json');
    res.json(spec);

  } catch (error) {
    logger.error('[Docs] 获取API文档失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DOCS_FETCH_ERROR',
        message: '获取API文档失败'
      }
    });
  }
});

/**
 * 获取API端点列表
 */
router.get('/endpoints', (req, res) => {
  try {
    const endpoints = swaggerService.getEndpoints();
    const groupedEndpoints = swaggerService.getEndpointsByTag();

    res.json({
      success: true,
      data: {
        endpoints,
        grouped: groupedEndpoints,
        total: endpoints.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Docs] 获取端点列表失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ENDPOINTS_FETCH_ERROR',
        message: '获取端点列表失败'
      }
    });
  }
});

/**
 * 获取API模型列表
 */
router.get('/schemas', (req, res) => {
  try {
    const schemas = swaggerService.getSchemas();

    res.json({
      success: true,
      data: {
        schemas,
        total: schemas.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Docs] 获取模型列表失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCHEMAS_FETCH_ERROR',
        message: '获取模型列表失败'
      }
    });
  }
});

/**
 * 验证API文档
 */
router.get('/validate', (req, res) => {
  try {
    const validation = swaggerService.validateDocs();

    res.json({
      success: true,
      data: validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Docs] 验证API文档失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '验证API文档失败'
      }
    });
  }
});

/**
 * 重新生成API文档
 */
router.post('/regenerate', (req, res) => {
  try {
    swaggerService.regenerateDocs()
      .then(result => {
        res.json({
          success: true,
          message: 'API文档重新生成成功',
          data: result.stats,
          timestamp: new Date().toISOString()
        });
      })
      .catch(error => {
        logger.error('[Docs] 重新生成文档失败:', error);
        res.status(500).json({
          success: false,
          error: {
            code: 'REGENERATE_ERROR',
            message: '重新生成API文档失败'
          }
        });
      });

  } catch (error) {
    logger.error('[Docs] 处理重新生成请求失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REQUEST_ERROR',
        message: '处理请求失败'
      }
    });
  }
});

/**
 * 获取文档统计信息
 */
router.get('/stats', (req, res) => {
  try {
    const stats = swaggerService.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Docs] 获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_ERROR',
        message: '获取统计信息失败'
      }
    });
  }
});

/**
 * 设置自动更新
 */
router.post('/auto-update', (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: 'enabled参数必须是布尔值'
        }
      });
    }

    swaggerService.setAutoUpdate(enabled);

    res.json({
      success: true,
      message: `自动更新已${enabled ? '启用' : '禁用'}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('[Docs] 设置自动更新失败:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTO_UPDATE_ERROR',
        message: '设置自动更新失败'
      }
    });
  }
});

/**
 * API文档主页（HTML）
 */
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>API文档 - AI照片处理后端</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
            }
            .container {
                background: white;
                border-radius: 8px;
                padding: 30px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
                text-align: center;
                margin-bottom: 40px;
            }
            .header h1 {
                color: #2c3e50;
                margin-bottom: 10px;
            }
            .header p {
                color: #7f8c8d;
                font-size: 18px;
            }
            .section {
                margin-bottom: 30px;
            }
            .section h2 {
                color: #34495e;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid #3498db;
            }
            .stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .stat-card {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
            }
            .stat-number {
                font-size: 2em;
                font-weight: bold;
                margin-bottom: 5px;
            }
            .stat-label {
                opacity: 0.9;
            }
            .links {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
                justify-content: center;
            }
            .link {
                background: #3498db;
                color: white;
                padding: 12px 24px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 500;
                transition: background-color 0.3s;
            }
            .link:hover {
                background: #2980b9;
            }
            .link.secondary {
                background: #95a5a6;
            }
            .link.secondary:hover {
                background: #7f8c8d;
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                color: #7f8c8d;
                padding-top: 20px;
                border-top: 1px solid #e9ecef;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📚 AI照片处理后端API文档</h1>
                <p>完整、实时更新的API文档和开发者指南</p>
            </div>

            <div class="section">
                <h2>📊 文档统计</h2>
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-number" id="endpoint-count">-</div>
                        <div class="stat-label">API端点</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="schema-count">-</div>
                        <div class="stat-label">数据模型</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="update-count">-</div>
                        <div class="stat-label">更新次数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number" id="last-update">-</div>
                        <div class="stat-label">最后更新</div>
                    </div>
                </div>
            </div>

            <div class="section">
                <h2>📄 文档资源</h2>
                <div class="links">
                    <a href="/api/docs/swagger.json" class="link">OpenAPI规范 (JSON)</a>
                    <a href="/api/docs/endpoints" class="link">API端点列表</a>
                    <a href="/api/docs/schemas" class="link">数据模型</a>
                    <a href="/api/docs/stats" class="link">统计信息</a>
                    <a href="/api/docs/validate" class="link secondary">验证文档</a>
                    <a href="index.html" target="_blank" class="link">Swagger UI</a>
                </div>
            </div>

            <div class="section">
                <h2>🔧 开发工具</h2>
                <div class="links">
                    <a href="/api/docs/regenerate" class="link secondary">重新生成文档</a>
                    <a href="/api/docs/auto-update" class="link secondary">设置自动更新</a>
                </div>
            </div>

            <div class="section">
                <h2>📚 使用指南</h2>
                <h3>认证方式</h3>
                <p>使用JWT Bearer Token进行认证：</p>
                <pre><code>Authorization: Bearer &lt;your-jwt-token&gt;</code></pre>

                <h3>实时通信</h3>
                <p>WebSocket连接地址：<code>ws://localhost:3001</code></p>

                <h3>API响应格式</h3>
                <pre><code>{
  "success": true,
  "data": { ... },
  "error": { ... },
  "timestamp": "2025-01-03T16:56:00.000Z"
}</code></pre>
            </div>

            <div class="footer">
                <p>© 2025 AI照片处理后端 | API文档自动生成</p>
            </div>
        </div>

        <script>
            // 加载统计数据
            fetch('/api/docs/stats')
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        document.getElementById('endpoint-count').textContent = data.data.totalEndpoints || 0;
                        document.getElementById('schema-count').textContent = data.data.totalSchemas || 0;
                        document.getElementById('update-count').textContent = data.data.updateCount || 0;
                        document.getElementById('last-update').textContent =
                            new Date(data.data.lastChecked).toLocaleString();
                    }
                })
                .catch(error => {
                    console.error('加载统计数据失败:', error);
                });
        </script>
    </body>
    </html>
  `);
});

module.exports = router;