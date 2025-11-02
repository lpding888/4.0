'use client';

import { useEffect, useRef } from 'react';
import { message } from 'antd';

interface JSONEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  readOnly?: boolean;
}

/**
 * JSONEditor - JSON 编辑器组件
 *
 * 艹，使用 textarea 临时代替 monaco-editor
 * 后续可以升级为使用 @monaco-editor/react
 */
export default function JSONEditor({
  value,
  onChange,
  height = 400,
  readOnly = false
}: JSONEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 格式化 JSON
  const formatJSON = () => {
    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      onChange(formatted);
      message.success('JSON 格式化成功');
    } catch (error: any) {
      message.error('JSON 格式错误：' + error.message);
    }
  };

  // 验证 JSON
  const validateJSON = () => {
    try {
      JSON.parse(value);
      message.success('JSON 格式正确');
      return true;
    } catch (error: any) {
      message.error('JSON 格式错误：' + error.message);
      return false;
    }
  };

  return (
    <div className="relative">
      {/* 工具栏 */}
      <div className="flex gap-2 mb-2">
        <button
          onClick={formatJSON}
          className="px-3 py-1 text-xs
            border border-cyan-400/50
            bg-cyan-500/20
            text-cyan-300
            rounded
            hover:bg-cyan-400/30
            transition-all duration-300"
        >
          格式化
        </button>
        <button
          onClick={validateJSON}
          className="px-3 py-1 text-xs
            border border-teal-400/50
            bg-teal-500/20
            text-teal-300
            rounded
            hover:bg-teal-400/30
            transition-all duration-300"
        >
          验证
        </button>
      </div>

      {/* 编辑器 */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="
          w-full
          font-mono text-sm
          bg-slate-900
          text-white
          border border-white/20
          rounded-lg
          p-4
          focus:outline-none focus:border-cyan-400/50
          resize-none
        "
        style={{ height: `${height}px` }}
        spellCheck={false}
      />
    </div>
  );
}
