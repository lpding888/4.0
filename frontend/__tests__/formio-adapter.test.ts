/**
 * Formio → UFS 适配器单元测试
 * 艹，这个tm测试所有字段类型的映射逻辑！
 */

import {
  convertFormioToUFS,
  validateUFSSchema,
  AdapterError,
  SUPPORTED_FORMIO_TYPES,
} from '../src/lib/formio/adapter';
import { UFSFieldType } from '../src/lib/types/ufs';

describe('Formio → UFS Adapter', () => {
  // ========== 测试1: textfield → input ==========
  test('应该正确转换textfield为input类型', () => {
    const formioSchema = {
      components: [
        {
          type: 'textfield',
          key: 'username',
          label: '用户名',
          placeholder: '请输入用户名',
          defaultValue: '',
          validate: {
            required: true,
            minLength: 3,
            maxLength: 20,
          },
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields).toHaveLength(1);
    expect(ufs.fields[0]).toMatchObject({
      key: 'username',
      type: UFSFieldType.INPUT,
      label: '用户名',
      placeholder: '请输入用户名',
      validation: {
        required: true,
        minLength: 3,
        maxLength: 20,
      },
    });
  });

  // ========== 测试2: textarea → textarea ==========
  test('应该正确转换textarea', () => {
    const formioSchema = {
      components: [
        {
          type: 'textarea',
          key: 'description',
          label: '描述',
          rows: 5,
          validate: {
            required: false,
            maxLength: 500,
          },
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields[0]).toMatchObject({
      key: 'description',
      type: UFSFieldType.TEXTAREA,
      label: '描述',
      rows: 5,
      validation: {
        maxLength: 500,
      },
    });
  });

  // ========== 测试3: number → number ==========
  test('应该正确转换number类型', () => {
    const formioSchema = {
      components: [
        {
          type: 'number',
          key: 'age',
          label: '年龄',
          validate: {
            required: true,
            min: 0,
            max: 150,
          },
          step: 1,
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields[0]).toMatchObject({
      key: 'age',
      type: UFSFieldType.NUMBER,
      label: '年龄',
      min: 0,
      max: 150,
      step: 1,
      validation: {
        required: true,
        min: 0,
        max: 150,
      },
    });
  });

  // ========== 测试4: email → input (with email validation) ==========
  test('应该正确转换email类型', () => {
    const formioSchema = {
      components: [
        {
          type: 'email',
          key: 'email',
          label: '邮箱',
          validate: {
            required: true,
            email: true,
          },
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields[0]).toMatchObject({
      key: 'email',
      type: UFSFieldType.INPUT,
      label: '邮箱',
      validation: {
        required: true,
        email: true,
      },
    });
  });

  // ========== 测试5: select → select ==========
  test('应该正确转换select类型及其选项', () => {
    const formioSchema = {
      components: [
        {
          type: 'select',
          key: 'country',
          label: '国家',
          data: {
            values: [
              { label: '中国', value: 'cn' },
              { label: '美国', value: 'us' },
              { label: '日本', value: 'jp' },
            ],
          },
          validate: {
            required: true,
          },
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields[0]).toMatchObject({
      key: 'country',
      type: UFSFieldType.SELECT,
      label: '国家',
      validation: {
        required: true,
      },
    });
    expect(ufs.fields[0].options).toEqual([
      { label: '中国', value: 'cn' },
      { label: '美国', value: 'us' },
      { label: '日本', value: 'jp' },
    ]);
  });

  // ========== 测试6: radio → radio ==========
  test('应该正确转换radio类型', () => {
    const formioSchema = {
      components: [
        {
          type: 'radio',
          key: 'gender',
          label: '性别',
          values: [
            { label: '男', value: 'male' },
            { label: '女', value: 'female' },
          ],
          validate: {
            required: true,
          },
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields[0]).toMatchObject({
      key: 'gender',
      type: UFSFieldType.RADIO,
      label: '性别',
    });
    expect(ufs.fields[0].options).toEqual([
      { label: '男', value: 'male' },
      { label: '女', value: 'female' },
    ]);
  });

  // ========== 测试7: checkbox → switch ==========
  test('应该正确转换checkbox为switch类型', () => {
    const formioSchema = {
      components: [
        {
          type: 'checkbox',
          key: 'agree',
          label: '同意服务条款',
          defaultValue: false,
          validate: {
            required: true,
          },
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields[0]).toMatchObject({
      key: 'agree',
      type: UFSFieldType.SWITCH,
      label: '同意服务条款',
      defaultValue: false,
      validation: {
        required: true,
      },
    });
  });

  // ========== 测试8: selectboxes → checkbox ==========
  test('应该正确转换selectboxes为checkbox类型', () => {
    const formioSchema = {
      components: [
        {
          type: 'selectboxes',
          key: 'hobbies',
          label: '爱好',
          values: [
            { label: '阅读', value: 'reading' },
            { label: '运动', value: 'sports' },
            { label: '音乐', value: 'music' },
          ],
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields[0]).toMatchObject({
      key: 'hobbies',
      type: UFSFieldType.CHECKBOX,
      label: '爱好',
    });
    expect(ufs.fields[0].options).toHaveLength(3);
  });

  // ========== 测试9: datetime → date ==========
  test('应该正确转换datetime类型', () => {
    const formioSchema = {
      components: [
        {
          type: 'datetime',
          key: 'birthday',
          label: '生日',
          validate: {
            required: true,
          },
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields[0]).toMatchObject({
      key: 'birthday',
      type: UFSFieldType.DATE,
      label: '生日',
      validation: {
        required: true,
      },
    });
  });

  // ========== 测试10: file → image ==========
  test('应该正确转换file类型为image', () => {
    const formioSchema = {
      components: [
        {
          type: 'file',
          key: 'avatar',
          label: '头像',
          image: true,
          validate: {
            required: false,
          },
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields[0]).toMatchObject({
      key: 'avatar',
      type: UFSFieldType.IMAGE,
      label: '头像',
      accept: 'image/*',
    });
  });

  // ========== 测试11: 条件显示 (visibleWhen) ==========
  test('应该正确转换conditional为visibleWhen', () => {
    const formioSchema = {
      components: [
        {
          type: 'textfield',
          key: 'companyName',
          label: '公司名称',
          conditional: {
            show: true,
            when: 'hasCompany',
            eq: true,
          },
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields[0].visibleWhen).toEqual({
      field: 'hasCompany',
      operator: 'eq',
      value: true,
    });
  });

  // ========== 测试12: 多个字段同时转换 ==========
  test('应该正确转换包含多个字段的Schema', () => {
    const formioSchema = {
      components: [
        {
          type: 'textfield',
          key: 'name',
          label: '姓名',
          validate: { required: true },
        },
        {
          type: 'email',
          key: 'email',
          label: '邮箱',
          validate: { required: true, email: true },
        },
        {
          type: 'number',
          key: 'age',
          label: '年龄',
          validate: { min: 0, max: 150 },
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields).toHaveLength(3);
    expect(ufs.fields[0].key).toBe('name');
    expect(ufs.fields[1].key).toBe('email');
    expect(ufs.fields[2].key).toBe('age');
  });

  // ========== 测试13: 跳过布局组件 ==========
  test('应该跳过布局组件（columns, panel等）', () => {
    const formioSchema = {
      components: [
        {
          type: 'textfield',
          key: 'field1',
          label: '字段1',
        },
        {
          type: 'panel',
          key: 'panel1',
          title: '面板',
          components: [],
        },
        {
          type: 'columns',
          key: 'columns1',
          columns: [],
        },
        {
          type: 'textfield',
          key: 'field2',
          label: '字段2',
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    // 只应该有2个字段，布局组件被跳过
    expect(ufs.fields).toHaveLength(2);
    expect(ufs.fields[0].key).toBe('field1');
    expect(ufs.fields[1].key).toBe('field2');
  });

  // ========== 测试14: 跳过按钮组件 ==========
  test('应该跳过button组件', () => {
    const formioSchema = {
      components: [
        {
          type: 'textfield',
          key: 'name',
          label: '姓名',
        },
        {
          type: 'button',
          key: 'submit',
          label: '提交',
        },
      ],
    };

    const ufs = convertFormioToUFS(formioSchema);

    expect(ufs.fields).toHaveLength(1);
    expect(ufs.fields[0].key).toBe('name');
  });

  // ========== 测试15: 检测重复key ==========
  test('应该检测并报错重复的key', () => {
    const formioSchema = {
      components: [
        {
          type: 'textfield',
          key: 'name',
          label: '姓名',
        },
        {
          type: 'email',
          key: 'name', // 重复的key
          label: '邮箱',
        },
      ],
    };

    expect(() => {
      convertFormioToUFS(formioSchema);
    }).toThrow(AdapterError);

    try {
      convertFormioToUFS(formioSchema);
    } catch (error: any) {
      expect(error.code).toBe('DUPLICATE_KEY');
      expect(error.details.key).toBe('name');
    }
  });

  // ========== 测试16: 处理空components ==========
  test('应该处理空components数组', () => {
    const formioSchema = {
      components: [],
    };

    expect(() => {
      convertFormioToUFS(formioSchema);
    }).toThrow(AdapterError);

    try {
      convertFormioToUFS(formioSchema);
    } catch (error: any) {
      expect(error.code).toBe('NO_SUPPORTED_COMPONENTS');
    }
  });

  // ========== 测试17: 处理非法Schema ==========
  test('应该拒绝非法的Formio Schema', () => {
    expect(() => {
      convertFormioToUFS(null as any);
    }).toThrow(AdapterError);

    expect(() => {
      convertFormioToUFS({} as any);
    }).toThrow(AdapterError);

    expect(() => {
      convertFormioToUFS({ components: 'not-an-array' } as any);
    }).toThrow(AdapterError);
  });

  // ========== 测试18: validateUFSSchema 基本校验 ==========
  test('validateUFSSchema应该正确校验UFS结构', () => {
    const validSchema = {
      version: '1.0',
      fields: [
        {
          key: 'name',
          type: UFSFieldType.INPUT,
          label: '姓名',
        },
      ],
    };

    const result = validateUFSSchema(validSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ========== 测试19: validateUFSSchema 检测缺少必要字段 ==========
  test('validateUFSSchema应该检测缺少version', () => {
    const invalidSchema: any = {
      fields: [
        {
          key: 'name',
          type: UFSFieldType.INPUT,
          label: '姓名',
        },
      ],
    };

    const result = validateUFSSchema(invalidSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing version field');
  });

  // ========== 测试20: validateUFSSchema 检测select必须有options ==========
  test('validateUFSSchema应该检测select类型必须有options', () => {
    const invalidSchema = {
      version: '1.0',
      fields: [
        {
          key: 'country',
          type: UFSFieldType.SELECT,
          label: '国家',
          // 缺少options
        },
      ],
    };

    const result = validateUFSSchema(invalidSchema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('must have options'))).toBe(true);
  });

  // ========== 测试21: 支持的类型列表 ==========
  test('SUPPORTED_FORMIO_TYPES应该包含所有支持的类型', () => {
    expect(SUPPORTED_FORMIO_TYPES).toContain('textfield');
    expect(SUPPORTED_FORMIO_TYPES).toContain('textarea');
    expect(SUPPORTED_FORMIO_TYPES).toContain('number');
    expect(SUPPORTED_FORMIO_TYPES).toContain('select');
    expect(SUPPORTED_FORMIO_TYPES).toContain('radio');
    expect(SUPPORTED_FORMIO_TYPES).toContain('checkbox');
    expect(SUPPORTED_FORMIO_TYPES).toContain('datetime');
    expect(SUPPORTED_FORMIO_TYPES).toContain('file');
    expect(SUPPORTED_FORMIO_TYPES.length).toBeGreaterThanOrEqual(10);
  });
});
