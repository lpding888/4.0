/**
 * PERF-P2-SSR-204: 模板中心客户端交互封装
 * 艹!这个组件负责所有的客户端交互,让父组件可以用SSR!
 *
 * @author 老王
 */

'use client';

import React, { useState } from 'react';
import { message, Modal, Form, Input, Select, Button, Space } from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import TemplateGrid from './TemplateGrid';
import type { Template } from './types';

const { TextArea } = Input;

interface TemplateClientWrapperProps {
  initialTemplates: Template[];
  typeConfig: any;
  categoryConfig: any;
  complexityConfig: any;
}

/**
 * 艹!模板中心客户端交互组件
 * 处理所有状态管理和模态框交互
 */
export default function TemplateClientWrapper({
  initialTemplates,
  typeConfig,
  categoryConfig,
  complexityConfig,
}: TemplateClientWrapperProps) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [useModalVisible, setUseModalVisible] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [form] = Form.useForm();
  const [useForm] = Form.useForm();

  // 艹!切换收藏状态
  const handleToggleFavorite = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTemplates = templates.map(template =>
      template.id === templateId
        ? { ...template, isFavorite: !template.isFavorite }
        : template
    );
    setTemplates(updatedTemplates);

    const template = templates.find(t => t.id === templateId);
    if (template) {
      message.success(template.isFavorite ? '已取消收藏' : '已添加到收藏');
    }
  };

  // 艹!预览模板
  const handlePreviewTemplate = (template: Template) => {
    setCurrentTemplate(template);
    setPreviewModalVisible(true);
  };

  // 艹!使用模板
  const handleUseTemplate = (template: Template) => {
    setCurrentTemplate(template);
    setUseModalVisible(true);
    // 预填充变量默认值
    const initialValues: Record<string, any> = {};
    template.variables?.forEach((variable: any) => {
      if (variable.defaultValue) {
        initialValues[variable.name] = variable.defaultValue;
      }
    });
    useForm.setFieldsValue(initialValues);
  };

  // 艹!复制模板
  const handleCopyTemplate = (template: Template) => {
    setCurrentTemplate(template);
    form.setFieldsValue({
      ...template,
      name: `${template.name} (副本)`,
      isPublic: false
    });
    setCreateModalVisible(true);
  };

  // 艹!删除模板
  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = templates.filter(template => template.id !== templateId);
    setTemplates(updatedTemplates);
    message.success('模板已删除');
  };

  // 艹!生成内容
  const handleGenerateContent = (values: Record<string, any>) => {
    if (!currentTemplate) return;

    let content = currentTemplate.content;
    // 替换变量
    currentTemplate.variables?.forEach((variable: any) => {
      const value = values[variable.name] || '';
      const regex = new RegExp(`{{${variable.name}}}`, 'g');
      content = content.replace(regex, value);
    });

    message.success('内容生成成功');
    setUseModalVisible(false);
    console.log('Generated content:', content);
  };

  return (
    <>
      <TemplateGrid
        templates={templates}
        typeConfig={typeConfig}
        categoryConfig={categoryConfig}
        complexityConfig={complexityConfig}
        onToggleFavorite={handleToggleFavorite}
        onPreview={handlePreviewTemplate}
        onUse={handleUseTemplate}
        onCopy={handleCopyTemplate}
        onDelete={handleDeleteTemplate}
      />

      {/* 艹!使用模板模态框 */}
      <Modal
        title={`使用模板 - ${currentTemplate?.name}`}
        open={useModalVisible}
        onCancel={() => setUseModalVisible(false)}
        footer={null}
        width={800}
      >
        {currentTemplate && (
          <Form
            form={useForm}
            layout="vertical"
            onFinish={handleGenerateContent}
          >
            <div style={{ marginBottom: 16 }}>
              <span style={{ color: '#666' }}>
                请填写以下变量来生成内容:
              </span>
            </div>

            {currentTemplate.variables?.map((variable: any) => (
              <Form.Item
                key={variable.name}
                name={variable.name}
                label={variable.label}
                rules={variable.required ? [{ required: true, message: `请输入${variable.label}` }] : []}
              >
                {variable.type === 'textarea' ? (
                  <TextArea
                    placeholder={variable.placeholder || `请输入${variable.label}`}
                    rows={3}
                  />
                ) : variable.type === 'select' ? (
                  <Select placeholder={`请选择${variable.label}`}>
                    {variable.options?.map((option: any) => (
                      <Select.Option key={option} value={option}>
                        {option}
                      </Select.Option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    type={variable.type}
                    placeholder={variable.placeholder || `请输入${variable.label}`}
                  />
                )}
              </Form.Item>
            ))}

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setUseModalVisible(false)}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit" icon={<ThunderboltOutlined />}>
                  生成内容
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </>
  );
}
