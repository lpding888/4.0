/**
 * Handlebars模板测试器 (CMS-303)
 * 艹！演示和测试模板渲染功能！
 */

'use client';

import { useState } from 'react';
import { Card, Button, Space, message, Alert, Tag, Divider } from 'antd';
import { PlayCircleOutlined, ClearOutlined, BulbOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import {
  renderTemplate,
  extractTemplateVars,
  validateTemplateVars,
  renderObjectTemplate,
} from '@/lib/utils/template';

// 动态导入Monaco编辑器
const MonacoEditor = dynamic(() => import('@/components/common/MonacoEditor'), {
  ssr: false,
  loading: () => <div style={{ padding: '48px', textAlign: 'center' }}>加载中...</div>,
});

/**
 * 默认模板示例
 */
const DEFAULT_TEMPLATE = `{
  "url": "{{form.imageUrl}}",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer {{system.token}}",
    "User-Agent": "{{system.userAgent}}"
  },
  "body": {
    "userId": "{{system.userId}}",
    "timestamp": "{{system.timestamp}}",
    "options": {
      "quality": "{{form.quality}}",
      "format": "{{form.format | uppercase}}"
    }
  }
}`;

/**
 * 默认上下文示例
 */
const DEFAULT_CONTEXT = `{
  "form": {
    "imageUrl": "https://example.com/image.jpg",
    "quality": "high",
    "format": "png"
  },
  "system": {
    "userId": "user_12345",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "userAgent": "Mozilla/5.0",
    "timestamp": "2025-11-01T08:00:00Z"
  }
}`;

export default function TemplateTestPage() {
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [contextJson, setContextJson] = useState(DEFAULT_CONTEXT);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [detectedVars, setDetectedVars] = useState<string[]>([]);
  const [validation, setValidation] = useState<{ valid: boolean; missingVars: string[] }>({
    valid: true,
    missingVars: [],
  });

  /**
   * 渲染模板
   */
  const handleRender = () => {
    try {
      // 解析context JSON
      const context = JSON.parse(contextJson);

      // 提取变量
      const vars = extractTemplateVars(template);
      setDetectedVars(vars);

      // 校验变量
      const validation = validateTemplateVars(template, context);
      setValidation(validation);

      if (!validation.valid) {
        message.warning(`发现${validation.missingVars.length}个未定义的变量`);
      }

      // 渲染模板
      const rendered = renderTemplate(template, context);
      setResult(rendered);
      setError('');

      message.success('模板渲染成功');
    } catch (err: any) {
      setError(err.message);
      setResult('');
      message.error(`渲染失败: ${err.message}`);
    }
  };

  /**
   * 清空结果
   */
  const handleClear = () => {
    setResult('');
    setError('');
    setDetectedVars([]);
    setValidation({ valid: true, missingVars: [] });
  };

  /**
   * 恢复默认
   */
  const handleReset = () => {
    setTemplate(DEFAULT_TEMPLATE);
    setContextJson(DEFAULT_CONTEXT);
    handleClear();
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card title="🚀 Handlebars模板测试器" extra={<Tag color="green">CMS-303</Tag>}>
        <Alert
          message="功能说明"
          description={
            <div>
              <p style={{ margin: 0 }}>
                这是Handlebars模板渲染的测试工具，支持 {'{{'} 变量 {'}}'} 语法。
              </p>
              <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                <li>输入模板字符串和上下文数据（JSON格式）</li>
                <li>点击“渲染模板”按钮查看结果</li>
                <li>自动检测模板中的变量引用</li>
                <li>校验变量是否都存在于 context 中</li>
              </ul>
            </div>
          }
          type="info"
          showIcon
          icon={<BulbOutlined />}
          style={{ marginBottom: '24px' }}
          closable
        />

        {/* 模板输入 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontWeight: 500, marginBottom: '8px' }}>模板字符串:</div>
          <MonacoEditor
            value={template}
            onChange={setTemplate}
            language="handlebars"
            height={300}
            theme="vs-dark"
            showActions={true}
          />
        </div>

        {/* 上下文输入 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontWeight: 500, marginBottom: '8px' }}>上下文数据 (JSON):</div>
          <MonacoEditor
            value={contextJson}
            onChange={setContextJson}
            language="json"
            height={250}
            theme="vs-dark"
            showActions={true}
          />
        </div>

        {/* 操作按钮 */}
        <div style={{ marginBottom: '24px' }}>
          <Space>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRender}>
              渲染模板
            </Button>
            <Button icon={<ClearOutlined />} onClick={handleClear}>
              清空结果
            </Button>
            <Button onClick={handleReset}>恢复默认</Button>
          </Space>
        </div>

        <Divider />

        {/* 检测到的变量 */}
        {detectedVars.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 500, marginBottom: '8px' }}>
              检测到的变量 ({detectedVars.length}):
            </div>
            <Space wrap>
              {detectedVars.map((varPath) => (
                <Tag
                  key={varPath}
                  color={
                    validation.missingVars.includes(varPath) ? 'red' : 'blue'
                  }
                >
                  {'{{'}{varPath}{'}}'}
                </Tag>
              ))}
            </Space>
          </div>
        )}

        {/* 变量校验结果 */}
        {!validation.valid && (
          <Alert
            message={`发现${validation.missingVars.length}个未定义的变量`}
            description={
              <div>
                以下变量在context中不存在：
                <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                  {validation.missingVars.map((varPath) => (
                    <li key={varPath}>
                      <code>{varPath}</code>
                    </li>
                  ))}
                </ul>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        {/* 渲染结果 */}
        {result && (
          <div>
            <div style={{ fontWeight: 500, marginBottom: '8px' }}>渲染结果:</div>
            <MonacoEditor
              value={result}
              language="json"
              height={300}
              theme="vs-dark"
              readOnly={true}
              showActions={true}
            />
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <Alert
            message="渲染失败"
            description={error}
            type="error"
            showIcon
            style={{ marginTop: '16px' }}
          />
        )}
      </Card>
    </div>
  );
}
