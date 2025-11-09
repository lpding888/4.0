/**
 * FilterBar筛选栏组件
 * 艹！提供统一的筛选条件输入界面！
 */

'use client';

import { Form, Input, Select, DatePicker, Button, Space, Row, Col } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';

export interface FilterConfig {
  name: string;
  label: string;
  type: 'input' | 'select' | 'date' | 'dateRange';
  options?: { label: string; value: string | number }[];
  placeholder?: string;
  allowClear?: boolean;
}

export interface FilterBarProps {
  filters: FilterConfig[];
  onFilter?: (values: any) => void;
  onReset?: () => void;
  loading?: boolean;
}

/**
 * FilterBar组件
 * 艹！动态渲染筛选条件！
 */
export function FilterBar({ filters, onFilter, onReset, loading }: FilterBarProps) {
  const [form] = Form.useForm();

  const handleFilter = () => {
    const values = form.getFieldsValue();
    onFilter?.(values);
  };

  const handleReset = () => {
    form.resetFields();
    onReset?.();
  };

  const renderFilterItem = (filter: FilterConfig) => {
    switch (filter.type) {
      case 'input':
        return <Input placeholder={filter.placeholder || `请输入${filter.label}`} />;
      case 'select':
        return (
          <Select
            placeholder={filter.placeholder || `请选择${filter.label}`}
            allowClear
            options={filter.options}
          />
        );
      case 'date':
        return <DatePicker style={{ width: '100%' }} placeholder={filter.placeholder} />;
      case 'dateRange':
        return <DatePicker.RangePicker style={{ width: '100%' }} />;
      default:
        return null;
    }
  };

  return (
    <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
      <Row gutter={16} style={{ width: '100%' }}>
        {filters.map((filter) => (
          <Col key={filter.name} span={6}>
            <Form.Item label={filter.label} name={filter.name} style={{ width: '100%' }}>
              {renderFilterItem(filter)}
            </Form.Item>
          </Col>
        ))}
        <Col>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleFilter} loading={loading}>
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>
        </Col>
      </Row>
    </Form>
  );
}
