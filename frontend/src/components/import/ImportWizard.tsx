'use client';

/**
 * 批量导入向导组件
 * 艹！这个组件支持CSV/JSON批量导入，字段映射，数据验证！
 *
 * @author 老王
 */

import React, { useState } from 'react';
import {
  Modal,
  Steps,
  Upload,
  Table,
  Button,
  Select,
  message,
  Alert,
  Progress,
  Space,
  Typography,
  Tag,
  Divider,
} from 'antd';
import {
  UploadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import Papa from 'papaparse';

const { Step } = Steps;
const { Dragger } = Upload;
const { Text, Title } = Typography;

/**
 * 导入配置
 */
interface ImportConfig {
  resourceType: 'user' | 'template' | 'prompt' | 'product';
  fieldMapping: Record<string, string>; // CSV列 -> 数据库字段
  requiredFields: string[]; // 必填字段
  validateFn?: (row: any) => { valid: boolean; errors: string[] };
}

/**
 * 导入结果
 */
interface ImportResult {
  total: number;
  success: number;
  failure: number;
  errors: Array<{ row: number; errors: string[] }>;
}

/**
 * ImportWizard Props
 */
interface ImportWizardProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (result: ImportResult) => void;
  config: ImportConfig;
}

/**
 * 批量导入向导
 */
export const ImportWizard: React.FC<ImportWizardProps> = ({
  visible,
  onClose,
  onSuccess,
  config,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(config.fieldMapping);
  const [validationResult, setValidationResult] = useState<{
    valid: number;
    invalid: number;
    errors: Array<{ row: number; errors: string[] }>;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  /**
   * 步骤1: 上传文件
   */
  const handleUpload = (file: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;

      // 判断文件类型
      if (file.name.endsWith('.csv')) {
        // 解析CSV
        Papa.parse(content, {
          header: true,
          skipEmptyLines: true,
          complete: (results: any) => {
            if (results.data.length === 0) {
              message.error('CSV文件为空');
              return;
            }

            const headers = Object.keys(results.data[0]);
            setHeaders(headers);
            setParsedData(results.data);
            setCurrentStep(1);
            message.success(`成功解析 ${results.data.length} 条记录`);
          },
          error: (error: any) => {
            message.error(`CSV解析失败: ${error.message}`);
          },
        });
      } else if (file.name.endsWith('.json')) {
        // 解析JSON
        try {
          const data = JSON.parse(content);
          const array = Array.isArray(data) ? data : [data];

          if (array.length === 0) {
            message.error('JSON文件为空');
            return;
          }

          const headers = Object.keys(array[0]);
          setHeaders(headers);
          setParsedData(array);
          setCurrentStep(1);
          message.success(`成功解析 ${array.length} 条记录`);
        } catch (error: any) {
          message.error(`JSON解析失败: ${error.message}`);
        }
      } else {
        message.error('不支持的文件格式');
      }
    };

    reader.readAsText(file);
    return false; // 阻止自动上传
  };

  /**
   * 步骤2: 验证数据
   */
  const handleValidate = () => {
    let validCount = 0;
    let invalidCount = 0;
    const errors: Array<{ row: number; errors: string[] }> = [];

    parsedData.forEach((row, index) => {
      const rowErrors: string[] = [];

      // 检查必填字段
      config.requiredFields.forEach((field) => {
        const csvField = fieldMapping[field];
        if (!csvField || !row[csvField]) {
          rowErrors.push(`缺少必填字段: ${field}`);
        }
      });

      // 自定义验证
      if (config.validateFn) {
        const result = config.validateFn(row);
        if (!result.valid) {
          rowErrors.push(...result.errors);
        }
      }

      if (rowErrors.length > 0) {
        invalidCount++;
        errors.push({ row: index + 1, errors: rowErrors });
      } else {
        validCount++;
      }
    });

    setValidationResult({ valid: validCount, invalid: invalidCount, errors });
    setCurrentStep(2);
  };

  /**
   * 步骤3: 执行导入
   */
  const handleImport = async () => {
    if (!validationResult || validationResult.invalid > 0) {
      message.error('存在无效数据，无法导入');
      return;
    }

    setImporting(true);

    try {
      // 转换数据（应用字段映射）
      const transformedData = parsedData.map((row) => {
        const newRow: any = {};
        Object.entries(fieldMapping).forEach(([dbField, csvField]) => {
          newRow[dbField] = row[csvField];
        });
        return newRow;
      });

      // 调用导入API
      const response = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: config.resourceType,
          data: transformedData,
        }),
      });

      if (!response.ok) {
        throw new Error('导入失败');
      }

      const result: ImportResult = await response.json();
      setImportResult(result);
      setCurrentStep(3);
      message.success(`导入成功：${result.success} 条`);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error: any) {
      message.error(`导入失败: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  /**
   * 重置向导
   */
  const handleReset = () => {
    setCurrentStep(0);
    setFileList([]);
    setParsedData([]);
    setHeaders([]);
    setFieldMapping(config.fieldMapping);
    setValidationResult(null);
    setImportResult(null);
  };

  /**
   * 关闭向导
   */
  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      title="批量导入向导"
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={null}
    >
      <Steps current={currentStep} style={{ marginBottom: 24 }}>
        <Step title="上传文件" icon={<UploadOutlined />} />
        <Step title="字段映射" />
        <Step title="数据验证" />
        <Step title="导入完成" />
      </Steps>

      {/* 步骤1: 上传文件 */}
      {currentStep === 0 && (
        <div>
          <Alert
            message="支持的格式"
            description="支持 CSV 和 JSON 格式，文件大小不超过 10MB"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Dragger
            fileList={fileList}
            beforeUpload={handleUpload}
            onRemove={() => setFileList([])}
            maxCount={1}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">支持 CSV / JSON 格式</p>
          </Dragger>
        </div>
      )}

      {/* 步骤2: 字段映射 */}
      {currentStep === 1 && (
        <div>
          <Alert
            message="字段映射"
            description="请将CSV列映射到对应的数据库字段"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Table
            dataSource={config.requiredFields.map((field) => ({
              field,
              required: true,
            }))}
            columns={[
              {
                title: '数据库字段',
                dataIndex: 'field',
                key: 'field',
                render: (field: string, record: any) => (
                  <Space>
                    <Text strong>{field}</Text>
                    {record.required && <Tag color="red">必填</Tag>}
                  </Space>
                ),
              },
              {
                title: 'CSV列',
                key: 'mapping',
                render: (_, record: any) => (
                  <Select
                    style={{ width: '100%' }}
                    value={fieldMapping[record.field]}
                    onChange={(value) =>
                      setFieldMapping({ ...fieldMapping, [record.field]: value })
                    }
                    options={headers.map((h) => ({ label: h, value: h }))}
                  />
                ),
              },
            ]}
            pagination={false}
            rowKey="field"
          />

          <Divider />

          <Text type="secondary">
            数据预览（前3条）：
          </Text>
          <Table
            dataSource={parsedData.slice(0, 3)}
            columns={headers.map((h) => ({
              title: h,
              dataIndex: h,
              key: h,
              ellipsis: true,
            }))}
            pagination={false}
            scroll={{ x: 800 }}
            style={{ marginTop: 8 }}
          />

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCurrentStep(0)}>上一步</Button>
              <Button type="primary" onClick={handleValidate}>
                下一步：验证数据
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* 步骤3: 数据验证 */}
      {currentStep === 2 && validationResult && (
        <div>
          <Alert
            message="数据验证结果"
            description={
              <div>
                <Text>有效记录: <Text strong type="success">{validationResult.valid}</Text></Text>
                <Divider type="vertical" />
                <Text>无效记录: <Text strong type="danger">{validationResult.invalid}</Text></Text>
              </div>
            }
            type={validationResult.invalid > 0 ? 'warning' : 'success'}
            showIcon
            style={{ marginBottom: 16 }}
          />

          {validationResult.errors.length > 0 && (
            <div>
              <Title level={5}>
                <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
                错误详情
              </Title>
              <Table
                dataSource={validationResult.errors}
                columns={[
                  {
                    title: '行号',
                    dataIndex: 'row',
                    key: 'row',
                    width: 80,
                  },
                  {
                    title: '错误信息',
                    dataIndex: 'errors',
                    key: 'errors',
                    render: (errors: string[]) => (
                      <div>
                        {errors.map((err, i) => (
                          <div key={i}>
                            <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                            {err}
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
                pagination={{ pageSize: 5 }}
                rowKey="row"
              />
            </div>
          )}

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCurrentStep(1)}>上一步</Button>
              <Button
                type="primary"
                onClick={handleImport}
                loading={importing}
                disabled={validationResult.invalid > 0}
              >
                开始导入
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* 步骤4: 导入完成 */}
      {currentStep === 3 && importResult && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />

          <Title level={3}>导入完成！</Title>

          <div style={{ marginTop: 24 }}>
            <Space size="large">
              <Statistic title="总记录数" value={importResult.total} />
              <Statistic title="成功" value={importResult.success} valueStyle={{ color: '#52c41a' }} />
              <Statistic title="失败" value={importResult.failure} valueStyle={{ color: '#ff4d4f' }} />
            </Space>
          </div>

          <div style={{ marginTop: 32 }}>
            <Space>
              <Button icon={<RollbackOutlined />} onClick={handleReset}>
                再次导入
              </Button>
              <Button type="primary" onClick={handleClose}>
                完成
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
};

/**
 * Statistic组件（简化版）
 */
const Statistic: React.FC<{ title: string; value: number; valueStyle?: React.CSSProperties }> = ({
  title,
  value,
  valueStyle,
}) => (
  <div style={{ textAlign: 'center' }}>
    <Text type="secondary">{title}</Text>
    <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 4, ...valueStyle }}>{value}</div>
  </div>
);
