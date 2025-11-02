/**
 * 变量选择器组件
 * 艹！用于在流程编辑器中选择变量，支持form/system/node变量！
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Input, Tree, Empty, Tag, Alert } from 'antd';
import { SearchOutlined, FolderOutlined, FileTextOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';

const { Search } = Input;

/**
 * 变量来源类型
 */
export type VarSource = 'form' | 'system' | 'node';

/**
 * 变量节点
 */
export interface VarNode {
  key: string; // 完整路径，如 "form.userName"
  title: string; // 显示名称
  path: string; // 变量路径（用于{{}}占位）
  source: VarSource; // 来源
  type?: string; // 数据类型
  children?: VarNode[];
  isLeaf?: boolean;
}

/**
 * Props
 */
export interface VarPickerProps {
  /** 可用的变量列表 */
  variables: VarNode[];

  /** 选中变量回调 */
  onSelect?: (varPath: string) => void;

  /** 是否显示校验错误 */
  showValidation?: boolean;

  /** 未定义的变量路径（会标红） */
  undefinedPaths?: string[];

  /** 高度 */
  height?: number;

  /** 占位符 */
  placeholder?: string;
}

/**
 * 变量选择器组件
 * 艹！这个组件提供树形结构浏览变量，支持搜索和校验！
 */
export const VarPicker: React.FC<VarPickerProps> = ({
  variables,
  onSelect,
  showValidation = true,
  undefinedPaths = [],
  height = 400,
  placeholder = '搜索变量...',
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  /**
   * 转换为Ant Design Tree数据格式
   */
  const treeData = useMemo(() => {
    const convertToTreeNode = (node: VarNode): DataNode => {
      const isUndefined = undefinedPaths.includes(node.path);

      return {
        key: node.key,
        title: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: isUndefined ? '#ff4d4f' : undefined }}>
              {node.title}
            </span>
            {node.type && <Tag color="blue">{node.type}</Tag>}
            {isUndefined && showValidation && <Tag color="error">未定义</Tag>}
          </div>
        ),
        icon: node.isLeaf ? <FileTextOutlined /> : <FolderOutlined />,
        isLeaf: node.isLeaf,
        children: node.children?.map(convertToTreeNode),
      };
    };

    return variables.map(convertToTreeNode);
  }, [variables, undefinedPaths, showValidation]);

  /**
   * 搜索过滤
   */
  const filteredTreeData = useMemo(() => {
    if (!searchValue) return treeData;

    const filterNode = (nodes: DataNode[]): DataNode[] => {
      return nodes
        .map((node) => {
          const matches = String(node.title)
            .toLowerCase()
            .includes(searchValue.toLowerCase());

          const filteredChildren = node.children ? filterNode(node.children) : [];

          if (matches || filteredChildren.length > 0) {
            return {
              ...node,
              children: filteredChildren.length > 0 ? filteredChildren : node.children,
            };
          }

          return null;
        })
        .filter(Boolean) as DataNode[];
    };

    return filterNode(treeData);
  }, [treeData, searchValue]);

  /**
   * 自动展开搜索结果
   */
  const searchExpandedKeys = useMemo(() => {
    if (!searchValue) return [];

    const keys: string[] = [];
    const findKeys = (nodes: DataNode[]) => {
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          keys.push(node.key as string);
          findKeys(node.children);
        }
      });
    };

    findKeys(filteredTreeData);
    return keys;
  }, [filteredTreeData, searchValue]);

  /**
   * 处理节点选择
   */
  const handleSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length === 0) return;

    const selectedKey = selectedKeys[0] as string;
    const selectedNode = findNodeByKey(variables, selectedKey);

    if (selectedNode && selectedNode.isLeaf) {
      // 艹！选中叶子节点，写入占位符
      const placeholder = `{{${selectedNode.path}}}`;
      onSelect?.(placeholder);
    }
  };

  /**
   * 查找节点
   */
  const findNodeByKey = (nodes: VarNode[], key: string): VarNode | null => {
    for (const node of nodes) {
      if (node.key === key) return node;
      if (node.children) {
        const found = findNodeByKey(node.children, key);
        if (found) return found;
      }
    }
    return null;
  };

  /**
   * 处理展开/折叠
   */
  const handleExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys as string[]);
  };

  return (
    <div style={{ width: '100%' }}>
      {/* 搜索框 */}
      <Search
        placeholder={placeholder}
        prefix={<SearchOutlined />}
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        allowClear
        style={{ marginBottom: '8px' }}
      />

      {/* 校验提示 */}
      {showValidation && undefinedPaths.length > 0 && (
        <Alert
          message={`发现 ${undefinedPaths.length} 个未定义的变量引用`}
          type="error"
          showIcon
          closable
          style={{ marginBottom: '8px' }}
        />
      )}

      {/* 变量树 */}
      <div
        style={{
          height,
          overflow: 'auto',
          border: '1px solid #d9d9d9',
          borderRadius: '4px',
          padding: '8px',
        }}
      >
        {filteredTreeData.length === 0 ? (
          <Empty description="无可用变量" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Tree
            showIcon
            treeData={filteredTreeData}
            expandedKeys={searchValue ? searchExpandedKeys : expandedKeys}
            onExpand={handleExpand}
            onSelect={handleSelect}
            selectable
          />
        )}
      </div>
    </div>
  );
};

/**
 * 构建默认变量树
 * 艹！这个工具函数帮助快速构建变量树！
 */
export const buildDefaultVarTree = (options?: {
  formFields?: string[];
  systemVars?: string[];
  nodeOutputs?: Array<{ nodeId: string; outputs: string[] }>;
}): VarNode[] => {
  const tree: VarNode[] = [];

  // 1. Form变量
  if (options?.formFields && options.formFields.length > 0) {
    tree.push({
      key: 'form',
      title: '表单变量 (form.*)',
      path: 'form',
      source: 'form',
      children: options.formFields.map((field) => ({
        key: `form.${field}`,
        title: field,
        path: `form.${field}`,
        source: 'form',
        type: 'string',
        isLeaf: true,
      })),
    });
  }

  // 2. System变量
  const defaultSystemVars = options?.systemVars || [
    'userId',
    'timestamp',
    'requestId',
    'env',
  ];

  tree.push({
    key: 'system',
    title: '系统变量 (system.*)',
    path: 'system',
    source: 'system',
    children: defaultSystemVars.map((varName) => ({
      key: `system.${varName}`,
      title: varName,
      path: `system.${varName}`,
      source: 'system',
      type: 'string',
      isLeaf: true,
    })),
  });

  // 3. 上游节点输出
  if (options?.nodeOutputs && options.nodeOutputs.length > 0) {
    options.nodeOutputs.forEach(({ nodeId, outputs }) => {
      tree.push({
        key: `node.${nodeId}`,
        title: `节点输出 (node.${nodeId}.*)`,
        path: `node.${nodeId}`,
        source: 'node',
        children: outputs.map((output) => ({
          key: `node.${nodeId}.${output}`,
          title: output,
          path: `node.${nodeId}.${output}`,
          source: 'node',
          type: 'any',
          isLeaf: true,
        })),
      });
    });
  }

  return tree;
};

/**
 * 校验变量引用
 * 艹！这个工具函数检查{{}}占位符是否有效！
 */
export const validateVarReferences = (
  text: string,
  availableVars: VarNode[]
): {
  isValid: boolean;
  undefinedPaths: string[];
  references: string[];
} => {
  // 提取所有{{}}占位符
  const regex = /\{\{([^}]+)\}\}/g;
  const references: string[] = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    references.push(match[1].trim());
  }

  // 收集所有可用的叶子节点路径
  const collectLeafPaths = (nodes: VarNode[]): string[] => {
    const paths: string[] = [];
    nodes.forEach((node) => {
      if (node.isLeaf) {
        paths.push(node.path);
      }
      if (node.children) {
        paths.push(...collectLeafPaths(node.children));
      }
    });
    return paths;
  };

  const availablePaths = collectLeafPaths(availableVars);

  // 检查未定义的引用
  const undefinedPaths = references.filter((ref) => !availablePaths.includes(ref));

  return {
    isValid: undefinedPaths.length === 0,
    undefinedPaths,
    references,
  };
};

export default VarPicker;
