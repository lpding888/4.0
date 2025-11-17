/**
 * UFS表单渲染器单元测试
 * 艹，这个tm测试所有字段类型的渲染和交互！
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import UfsRenderer from '../src/components/ufs/UfsRenderer';
import { UFSSchema, UFSFieldType } from '../src/lib/types/ufs';

describe('UFS表单渲染器', () => {
  // ========== 测试1: 基本渲染 - INPUT类型 ==========
  test('应该正确渲染INPUT类型字段', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
          placeholder: '请输入用户名',
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument();
  });

  // ========== 测试2: TEXTAREA类型 ==========
  test('应该正确渲染TEXTAREA类型字段', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'description',
          type: UFSFieldType.TEXTAREA,
          label: '描述',
          rows: 5,
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    const textarea = screen.getByLabelText('描述');
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  // ========== 测试3: NUMBER类型 ==========
  test('应该正确渲染NUMBER类型字段', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'age',
          type: UFSFieldType.NUMBER,
          label: '年龄',
          min: 0,
          max: 150,
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    expect(screen.getByLabelText('年龄')).toBeInTheDocument();
  });

  // ========== 测试4: SELECT类型 ==========
  test('应该正确渲染SELECT类型字段及选项', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'country',
          type: UFSFieldType.SELECT,
          label: '国家',
          options: [
            { label: '中国', value: 'cn' },
            { label: '美国', value: 'us' },
          ],
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    expect(screen.getByLabelText('国家')).toBeInTheDocument();
  });

  // ========== 测试5: RADIO类型 ==========
  test('应该正确渲染RADIO类型字段及选项', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'gender',
          type: UFSFieldType.RADIO,
          label: '性别',
          options: [
            { label: '男', value: 'male' },
            { label: '女', value: 'female' },
          ],
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    expect(screen.getByText('男')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
  });

  // ========== 测试6: CHECKBOX类型 ==========
  test('应该正确渲染CHECKBOX类型字段', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'hobbies',
          type: UFSFieldType.CHECKBOX,
          label: '爱好',
          options: [
            { label: '阅读', value: 'reading' },
            { label: '运动', value: 'sports' },
          ],
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    expect(screen.getByText('阅读')).toBeInTheDocument();
    expect(screen.getByText('运动')).toBeInTheDocument();
  });

  // ========== 测试7: SWITCH类型 ==========
  test('应该正确渲染SWITCH类型字段', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'agree',
          type: UFSFieldType.SWITCH,
          label: '同意条款',
          defaultValue: false,
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    expect(screen.getByLabelText('同意条款')).toBeInTheDocument();
  });

  // ========== 测试8: 必填校验 ==========
  test('应该正确显示必填校验错误', async () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
          validation: {
            required: true,
          },
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    // 点击提交按钮
    const submitButton = screen.getByText('提交');
    fireEvent.click(submitButton);

    // 等待校验错误显示
    await waitFor(() => {
      expect(screen.getByText('用户名是必填项')).toBeInTheDocument();
    });
  });

  // ========== 测试9: 最小长度校验 ==========
  test('应该正确显示最小长度校验错误', async () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
          validation: {
            minLength: 3,
          },
        },
      ],
    };

    const { container } = render(<UfsRenderer schema={schema} />);

    const input = screen.getByLabelText('用户名');

    // 输入少于3个字符
    await userEvent.type(input, 'ab');

    // 触发提交
    const submitButton = screen.getByText('提交');
    fireEvent.click(submitButton);

    // 等待校验错误
    await waitFor(() => {
      expect(screen.getByText('用户名长度不能少于3个字符')).toBeInTheDocument();
    });
  });

  // ========== 测试10: Email校验 ==========
  test('应该正确显示Email校验错误', async () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'email',
          type: UFSFieldType.INPUT,
          label: '邮箱',
          validation: {
            email: true,
          },
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    const input = screen.getByLabelText('邮箱');

    // 输入非法邮箱
    await userEvent.type(input, 'invalid-email');

    // 触发提交
    const submitButton = screen.getByText('提交');
    fireEvent.click(submitButton);

    // 等待校验错误
    await waitFor(() => {
      expect(screen.getByText('邮箱必须是有效的邮箱地址')).toBeInTheDocument();
    });
  });

  // ========== 测试11: 默认值 ==========
  test('应该正确应用字段默认值', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
          defaultValue: 'admin',
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    const input = screen.getByLabelText('用户名') as HTMLInputElement;
    expect(input.value).toBe('admin');
  });

  // ========== 测试12: 外部默认值优先 ==========
  test('外部传入的默认值应该优先于字段defaultValue', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
          defaultValue: 'admin',
        },
      ],
    };

    render(
      <UfsRenderer
        schema={schema}
        defaultValues={{ username: 'external' }}
      />
    );

    const input = screen.getByLabelText('用户名') as HTMLInputElement;
    expect(input.value).toBe('external');
  });

  // ========== 测试13: 条件显示 - 等值判断 ==========
  test('应该正确处理visibleWhen条件显示（eq）', async () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'hasCompany',
          type: UFSFieldType.SWITCH,
          label: '有公司',
          defaultValue: false,
        },
        {
          key: 'companyName',
          type: UFSFieldType.INPUT,
          label: '公司名称',
          visibleWhen: {
            field: 'hasCompany',
            operator: 'eq',
            value: true,
          },
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    // 初始状态，公司名称不应该显示
    expect(screen.queryByLabelText('公司名称')).not.toBeInTheDocument();

    // 点击开关
    const switchButton = screen.getByRole('switch');
    fireEvent.click(switchButton);

    // 等待条件字段显示
    await waitFor(() => {
      expect(screen.getByLabelText('公司名称')).toBeInTheDocument();
    });
  });

  // ========== 测试14: 禁用状态 ==========
  test('应该正确应用字段禁用状态', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
          disabled: true,
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    const input = screen.getByLabelText('用户名');
    expect(input).toBeDisabled();
  });

  // ========== 测试15: 只读模式 ==========
  test('只读模式应该禁用所有字段', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
        },
        {
          key: 'email',
          type: UFSFieldType.INPUT,
          label: '邮箱',
        },
      ],
    };

    render(<UfsRenderer schema={schema} readOnly />);

    expect(screen.getByLabelText('用户名')).toBeDisabled();
    expect(screen.getByLabelText('邮箱')).toBeDisabled();
  });

  // ========== 测试16: 描述文本 ==========
  test('应该正确显示字段描述', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
          description: '用户名用于登录系统',
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    expect(screen.getByText('用户名用于登录系统')).toBeInTheDocument();
  });

  // ========== 测试17: onChange回调 ==========
  test('应该在表单值变化时触发onChange回调', async () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
        },
      ],
    };

    const handleChange = jest.fn();
    render(<UfsRenderer schema={schema} onChange={handleChange} />);

    const input = screen.getByLabelText('用户名');
    await userEvent.type(input, 'test');

    // onChange应该被多次调用（每输入一个字符触发一次）
    expect(handleChange).toHaveBeenCalled();
    expect(handleChange.mock.calls[handleChange.mock.calls.length - 1][0]).toMatchObject({
      username: 'test',
    });
  });

  // ========== 测试18: onSubmit回调 ==========
  test('应该在表单提交时触发onSubmit回调', async () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
          validation: {
            required: true,
          },
        },
      ],
    };

    const handleSubmit = jest.fn();
    render(<UfsRenderer schema={schema} onSubmit={handleSubmit} />);

    const input = screen.getByLabelText('用户名');
    await userEvent.type(input, 'testuser');

    const submitButton = screen.getByText('提交');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({ username: 'testuser' });
    });
  });

  // ========== 测试19: 隐藏提交按钮 ==========
  test('showSubmitButton=false应该隐藏提交按钮', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
        },
      ],
    };

    render(<UfsRenderer schema={schema} showSubmitButton={false} />);

    expect(screen.queryByText('提交')).not.toBeInTheDocument();
  });

  // ========== 测试20: 自定义提交按钮文本 ==========
  test('应该正确应用自定义提交按钮文本', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
        },
      ],
    };

    render(
      <UfsRenderer schema={schema} submitButtonText="保存" />
    );

    expect(screen.getByText('保存')).toBeInTheDocument();
    expect(screen.queryByText('提交')).not.toBeInTheDocument();
  });

  // ========== 测试21: 多个字段渲染 ==========
  test('应该正确渲染包含多个字段的表单', () => {
    const schema: UFSSchema = {
      version: '1.0',
      fields: [
        {
          key: 'username',
          type: UFSFieldType.INPUT,
          label: '用户名',
        },
        {
          key: 'email',
          type: UFSFieldType.INPUT,
          label: '邮箱',
        },
        {
          key: 'age',
          type: UFSFieldType.NUMBER,
          label: '年龄',
        },
      ],
    };

    render(<UfsRenderer schema={schema} />);

    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
    expect(screen.getByLabelText('年龄')).toBeInTheDocument();
  });
});
