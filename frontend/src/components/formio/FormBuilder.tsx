'use client';

/**
 * Form.io FormBuilder封装组件
 * 艹，这个tm使用动态导入关闭SSR，避免服务端渲染问题！
 */

import { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';

/**
 * FormBuilder组件Props
 */
export interface FormBuilderProps {
  schema?: any; // 初始Schema
  onChange?: (schema: any) => void; // Schema变化回调
  options?: any; // FormBuilder选项
}

/**
 * FormBuilder组件
 * 艹，使用useEffect + 动态import避免SSR问题
 */
export default function FormBuilder({ schema, onChange, options }: FormBuilderProps) {
  const builderRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 艹，确保只在客户端运行
    if (typeof window === 'undefined') {
      return;
    }

    let builderInstance: any = null;

    const initFormioBuilder = async () => {
      try {
        // 动态导入formiojs（关键！避免SSR）
        const Formio = (await import('formiojs')).default as any;
        const FormioUtils = (await import('formiojs/utils')).default as any;

        // 加载formio样式
        await import('formiojs/dist/formio.full.min.css');

        // 配置中文
        Formio.setBaseUrl('https://formio.form.io');

        // FormBuilder选项（艹，屏蔽premium组件）
        const builderOptions = {
          builder: {
            basic: {
              title: '基础字段',
              default: true,
              weight: 0,
              components: {
                textfield: true,
                textarea: true,
                number: true,
                email: true,
                phoneNumber: true,
                checkbox: true,
                selectboxes: true,
                select: true,
                radio: true,
                button: true,
              },
            },
            advanced: {
              title: '高级字段',
              weight: 10,
              components: {
                datetime: true,
                day: true,
                time: true,
                currency: true,
                survey: true,
                signature: true,
                tags: true,
              },
            },
            layout: {
              title: '布局',
              weight: 20,
              components: {
                htmlelement: true,
                content: true,
                columns: true,
                fieldset: true,
                panel: true,
                table: true,
                tabs: true,
                well: true,
              },
            },
            data: {
              title: '数据',
              weight: 30,
              components: {
                hidden: true,
                container: true,
                datagrid: true,
                editgrid: true,
              },
            },
            // 禁用premium组件
            premium: false,
            resource: false,
          },
          editForm: {
            textfield: [
              {
                key: 'display',
                components: [
                  {
                    key: 'label',
                    label: '标签',
                  },
                  {
                    key: 'placeholder',
                    label: '占位符',
                  },
                ],
              },
              {
                key: 'validation',
                components: [
                  {
                    key: 'required',
                    label: '必填',
                  },
                ],
              },
            ],
          },
          noDefaultSubmitButton: true,
          ...options,
        };

        // 创建FormBuilder实例
        if (containerRef.current) {
          builderInstance = await Formio.builder(
            containerRef.current,
            schema || { components: [] },
            builderOptions
          );

          builderRef.current = builderInstance;

          // 监听schema变化
          builderInstance.on('change', (changeSchema: any) => {
            if (onChange) {
              onChange(changeSchema);
            }
          });

          setLoading(false);
        }
      } catch (err: any) {
        console.error('[FormBuilder] 初始化失败:', err);
        setError(err.message || '加载FormBuilder失败');
        setLoading(false);
      }
    };

    initFormioBuilder();

    // 清理函数
    return () => {
      if (builderInstance && builderInstance.destroy) {
        builderInstance.destroy();
      }
    };
  }, []); // 只在mount时初始化一次

  // 更新schema（外部变更）
  useEffect(() => {
    if (builderRef.current && schema) {
      builderRef.current.setForm(schema).catch((err: any) => {
        console.error('[FormBuilder] 设置schema失败:', err);
      });
    }
  }, [schema]);

  if (error) {
    return (
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          color: '#ff4d4f',
        }}
      >
        <h3>加载FormBuilder失败</h3>
        <p>{error}</p>
        <p style={{ fontSize: '12px', color: '#999', marginTop: '16px' }}>
          提示：请确保已正确安装 formiojs 依赖包
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <Spin size="large" tip="正在加载FormBuilder..." />
      </div>
    );
  }

  return (
    <div>
      {/* FormBuilder容器 */}
      <div
        ref={containerRef}
        style={{
          minHeight: '600px',
          border: '1px solid #d9d9d9',
          borderRadius: '8px',
          background: '#fff',
        }}
      />
    </div>
  );
}
