/**
 * FilterBar 通用筛选栏组件
 * 艹，这个组件自动渲染各种筛选器，完美集成useTableFilter！
 */

'use client';

import React, { useMemo } from 'react';
import {
  Input,
  Select,
  DatePicker,
  InputNumber,
  Radio,
  Checkbox,
  Button,
  Space,
  Row,
  Col,
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { FilterBarProps, FilterConfig, FilterType } from './types';
import type { FilterValue } from '@/shared/hooks/useTableFilter';

const { RangePicker } = DatePicker;
const { Search } = Input;

/**
 * FilterBar 组件
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onFiltersChange,
  onReset,
  showReset = true,
  showSearch = false,
  onSearch,
  className,
  layout = 'inline',
  gutter = 16,
}) => {
  // 艹，过滤掉不可见的筛选器
  const visibleFilters = useMemo(() => {
    return filters.filter((f) => f.visible !== false);
  }, [filters]);

  /**
   * 渲染单个筛选器
   */
  const renderFilter = (filter: FilterConfig) => {
    const {
      key,
      type,
      label,
      placeholder,
      defaultValue,
      options,
      allowClear = true,
      width,
      disabled,
    } = filter;

    const commonProps = {
      placeholder: placeholder || `请选择${label}`,
      disabled,
      allowClear,
      style: { width: width || '100%' },
      onChange: (value: any) => {
        onFilterChange?.(key, value);
      },
    };

    switch (type) {
      case 'input':
        return (
          <Input
            {...commonProps}
            placeholder={placeholder || `请输入${label}`}
            defaultValue={defaultValue as string}
          />
        );

      case 'search':
        return (
          <Search
            {...commonProps}
            placeholder={placeholder || `搜索${label}`}
            defaultValue={defaultValue as string}
            onSearch={() => onSearch?.()}
            enterButton
          />
        );

      case 'select':
        return (
          <Select
            {...commonProps}
            defaultValue={defaultValue}
            options={options}
          />
        );

      case 'multiSelect':
        return (
          <Select
            {...commonProps}
            mode="multiple"
            defaultValue={defaultValue as any[]}
            options={options}
          />
        );

      case 'date':
        return (
          <DatePicker
            {...commonProps}
            defaultValue={defaultValue as any}
            format="YYYY-MM-DD"
          />
        );

      case 'dateRange':
        return (
          <RangePicker
            {...commonProps}
            defaultValue={defaultValue as any}
            format="YYYY-MM-DD"
          />
        );

      case 'number':
        return (
          <InputNumber
            {...commonProps}
            placeholder={placeholder || `请输入${label}`}
            defaultValue={defaultValue as number}
            style={{ width: width || '100%' }}
          />
        );

      case 'numberRange':
        return (
          <Space.Compact style={{ width: width || '100%' }}>
            <InputNumber
              placeholder="最小值"
              disabled={disabled}
              onChange={(value) => {
                const current = (defaultValue as [number, number]) || [null, null];
                onFilterChange?.(key, [value, current[1]]);
              }}
            />
            <InputNumber
              placeholder="最大值"
              disabled={disabled}
              onChange={(value) => {
                const current = (defaultValue as [number, number]) || [null, null];
                onFilterChange?.(key, [current[0], value]);
              }}
            />
          </Space.Compact>
        );

      case 'radio':
        return (
          <Radio.Group
            {...commonProps}
            defaultValue={defaultValue}
            options={options}
          />
        );

      case 'checkbox':
        return (
          <Checkbox.Group
            {...commonProps}
            defaultValue={defaultValue as any[]}
            options={options}
          />
        );

      default:
        console.warn(`[FilterBar] 不支持的筛选器类型: ${type}`);
        return null;
    }
  };

  /**
   * 处理重置
   */
  const handleReset = () => {
    onReset?.();
  };

  return (
    <div className={className} style={{ marginBottom: 16 }}>
      <Row gutter={gutter}>
        {visibleFilters.map((filter) => (
          <Col
            key={filter.key}
            xs={24}
            sm={12}
            md={layout === 'inline' ? 8 : 24}
            lg={layout === 'inline' ? 6 : 24}
          >
            <div style={{ marginBottom: layout === 'vertical' ? 8 : 0 }}>
              {layout === 'vertical' && (
                <div style={{ marginBottom: 4, fontWeight: 500 }}>
                  {filter.label}
                </div>
              )}
              {renderFilter(filter)}
            </div>
          </Col>
        ))}

        {/* 操作按钮 */}
        <Col
          xs={24}
          sm={12}
          md={layout === 'inline' ? 8 : 24}
          lg={layout === 'inline' ? 6 : 24}
        >
          <Space>
            {showSearch && (
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={onSearch}
              >
                搜索
              </Button>
            )}
            {showReset && (
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            )}
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default FilterBar;
