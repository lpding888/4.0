/**
 * Monaco Editor 通用组件 (CMS-301)
 * 艹！VS Code同款编辑器，支持多种语言和主题！
 */

'use client';

import { useRef, useState } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { Button, Space, message, Spin } from 'antd';
import { CopyOutlined, CheckOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons';
import type { editor } from 'monaco-editor';

/**
 * 变量节点（用于自动补全）
 */
export interface VarNode {
  label: string;
  path: string;
  type?: 'string' | 'number' | 'object' | 'array';
  description?: string;
  children?: VarNode[];
}

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string; // json, javascript, typescript, handlebars, html, css等
  height?: string | number;
  theme?: 'vs-dark' | 'light' | 'vs';
  readOnly?: boolean;
  options?: editor.IStandaloneEditorOptions;
  showActions?: boolean; // 是否显示工具栏
  onMount?: (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => void;

  // CMS-302: 变量自动补全
  availableVars?: VarNode[]; // 可用变量树
  enableVarCompletion?: boolean; // 是否启用变量补全（默认false）
}

/**
 * 递归flatten VarNode树，提取所有path
 * 艹！用于自动补全候选项！
 */
function flattenVarNodes(nodes: VarNode[], result: VarNode[] = []): VarNode[] {
  nodes.forEach((node) => {
    result.push(node);
    if (node.children && node.children.length > 0) {
      flattenVarNodes(node.children, result);
    }
  });
  return result;
}

export default function MonacoEditor({
  value,
  onChange,
  language = 'json',
  height = '400px',
  theme = 'vs-dark',
  readOnly = false,
  options = {},
  showActions = true,
  onMount,
  availableVars = [],
  enableVarCompletion = false,
}: MonacoEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * 编辑器挂载回调
   */
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setLoading(false);

    // 配置JSON语言的格式化选项
    if (language === 'json') {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [],
        enableSchemaRequest: false,
      });
    }

    // CMS-302: 注册变量自动补全Provider
    if (enableVarCompletion && availableVars.length > 0) {
      const flatVars = flattenVarNodes(availableVars);

      monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: ['{'], // 触发字符
        provideCompletionItems: (model, position) => {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          // 检测是否输入了 {{
          const match = textUntilPosition.match(/\{\{(\w+\.)*\w*$/);
          if (!match) {
            return { suggestions: [] };
          }

          // 提取已输入的部分（{{之后的内容）
          const alreadyTyped = match[0].substring(2); // 去掉 {{

          // 生成补全建议
          const suggestions = flatVars
            .filter((varNode) => varNode.path.startsWith(alreadyTyped))
            .map((varNode) => ({
              label: varNode.path,
              kind: monaco.languages.CompletionItemKind.Variable,
              detail: varNode.type || 'variable',
              documentation: varNode.description || `变量: ${varNode.path}`,
              insertText: varNode.path + '}}', // 自动补全并添加 }}
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column - alreadyTyped.length,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            }));

          return { suggestions };
        },
      });

      console.log(`[Monaco] 已注册变量自动补全，可用变量数: ${flatVars.length}`);
    }

    // 调用外部onMount回调
    if (onMount) {
      onMount(editor, monaco);
    }

    // 自动格式化（仅JSON）
    if (language === 'json' && !readOnly) {
      setTimeout(() => {
        editor.getAction('editor.action.formatDocument')?.run();
      }, 100);
    }
  };

  /**
   * 内容变化回调
   */
  const handleEditorChange = (value: string | undefined) => {
    if (onChange && value !== undefined) {
      onChange(value);
    }
  };

  /**
   * 复制内容
   */
  const handleCopy = () => {
    if (editorRef.current) {
      const content = editorRef.current.getValue();
      navigator.clipboard.writeText(content);
      setCopied(true);
      message.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /**
   * 格式化代码
   */
  const handleFormat = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
      message.success('已格式化');
    }
  };

  /**
   * 切换全屏
   */
  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 默认编辑器选项
  const defaultOptions: editor.IStandaloneEditorOptions = {
    readOnly,
    minimap: { enabled: !readOnly }, // 只读模式不显示小地图
    fontSize: 13,
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    formatOnPaste: true,
    formatOnType: true,
    wordWrap: 'on',
    ...options,
  };

  return (
    <div
      style={{
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : height,
        zIndex: isFullscreen ? 9999 : undefined,
        background: theme === 'vs-dark' ? '#1e1e1e' : '#fff',
        borderRadius: isFullscreen ? 0 : '4px',
        border: isFullscreen ? 'none' : '1px solid #d9d9d9',
        overflow: 'hidden',
      }}
    >
      {/* 工具栏 */}
      {showActions && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            background: theme === 'vs-dark' ? '#252526' : '#f5f5f5',
            borderBottom: `1px solid ${theme === 'vs-dark' ? '#3e3e42' : '#d9d9d9'}`,
          }}
        >
          <div style={{ fontSize: '12px', color: theme === 'vs-dark' ? '#ccc' : '#666' }}>
            {language.toUpperCase()} {readOnly && '(只读)'}
          </div>
          <Space size="small">
            {!readOnly && (
              <Button size="small" onClick={handleFormat}>
                格式化
              </Button>
            )}
            <Button
              size="small"
              icon={copied ? <CheckOutlined /> : <CopyOutlined />}
              onClick={handleCopy}
            >
              {copied ? '已复制' : '复制'}
            </Button>
            <Button
              size="small"
              icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
              onClick={handleToggleFullscreen}
            >
              {isFullscreen ? '退出全屏' : '全屏'}
            </Button>
          </Space>
        </div>
      )}

      {/* 加载中 */}
      {loading && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: showActions ? 'calc(100% - 40px)' : '100%',
          }}
        >
          <Spin tip="Monaco编辑器加载中..." />
        </div>
      )}

      {/* Monaco编辑器 */}
      <Editor
        height={showActions ? 'calc(100% - 40px)' : '100%'}
        language={language}
        value={value}
        theme={theme}
        options={defaultOptions}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        loading={null} // 使用自定义loading
      />
    </div>
  );
}
