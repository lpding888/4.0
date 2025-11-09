/**
 * UI Schema 类型定义
 * 艹，这个类型系统要支持动态表单渲染！
 *
 * @author 老王
 */

export type FieldCommon = {
  name: string;
  label: string;
  required?: boolean;
  help?: string;
  visible?: boolean;
};

export type FieldSelect = FieldCommon & {
  type: 'select';
  options: string[];
  default?: string;
  placeholder?: string;
};

export type FieldNumber = FieldCommon & {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  default?: number;
  placeholder?: string;
};

export type FieldText = FieldCommon & {
  type: 'text';
  default?: string;
  placeholder?: string;
};

export type FieldSlider = FieldCommon & {
  type: 'slider';
  min?: number;
  max?: number;
  step?: number;
  default?: number;
};

export type FieldSwitch = FieldCommon & {
  type: 'switch';
  default?: boolean;
};

export type FieldColor = FieldCommon & {
  type: 'color';
  default?: string;
};

export type UIField = FieldSelect | FieldNumber | FieldText | FieldSlider | FieldSwitch | FieldColor;
export type UISchema = { type: 'form'; fields: UIField[] };

export type Bootstrap = {
  version: number;
  menus: {
    key: string;
    title: string;
    path: string;
    icon?: string;
    hidden?: boolean;
  }[];
  tools: {
    key: string;
    group: string;
    title: string;
    icon?: string;
    pipeline: string;
    uiSchema: UISchema;
    enabled?: boolean;
  }[];
  editor: {
    quickActions: {
      key: string;
      title: string;
      pipeline: string;
    }[];
  };
  templates: {
    filters: Record<string, string[]>;
    cardsEndpoint: string;
  };
};
