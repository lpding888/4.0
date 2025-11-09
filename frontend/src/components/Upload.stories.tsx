import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Upload, Button, message } from 'antd';
import { UploadOutlined, InboxOutlined, PictureOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';

/**
 * QA-P2-STORY-208: Upload 组件 Story
 * 艹！上传组件，用于文件上传！
 *
 * @author 老王
 */

const meta: Meta<typeof Upload> = {
  title: 'Components/Upload',
  component: Upload,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# Upload 上传

用于文件上传，支持多种上传方式。

## 使用场景
- 图片上传
- 文件上传
- 拖拽上传
- 批量上传

## 上传规范
- ✅ 限制文件类型和大小
- ✅ 显示上传进度
- ✅ 提供清晰的错误提示
- ✅ 支持预览和删除
- ✅ 大文件使用分片上传
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * 基础上传
 */
export const Basic: Story = {
  render: () => {
    const props: UploadProps = {
      name: 'file',
      action: '/api/upload',
      beforeUpload: (file) => {
        const isLt2M = file.size / 1024 / 1024 < 2;
        if (!isLt2M) {
          message.error('文件大小不能超过 2MB');
        }
        return isLt2M;
      },
      onChange: (info) => {
        if (info.file.status === 'done') {
          message.success(`${info.file.name} 上传成功`);
        } else if (info.file.status === 'error') {
          message.error(`${info.file.name} 上传失败`);
        }
      },
    };

    return (
      <Upload {...props}>
        <Button icon={<UploadOutlined />}>点击上传</Button>
      </Upload>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '基础上传，点击按钮选择文件上传',
      },
    },
  },
};

/**
 * 图片上传
 */
export const ImageUpload: Story = {
  render: () => {
    const props: UploadProps = {
      name: 'file',
      action: '/api/upload',
      listType: 'picture',
      accept: 'image/*',
      beforeUpload: (file) => {
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
          message.error('只能上传图片文件');
          return false;
        }
        const isLt5M = file.size / 1024 / 1024 < 5;
        if (!isLt5M) {
          message.error('图片大小不能超过 5MB');
          return false;
        }
        return true;
      },
      onChange: (info) => {
        if (info.file.status === 'done') {
          message.success(`${info.file.name} 上传成功`);
        } else if (info.file.status === 'error') {
          message.error(`${info.file.name} 上传失败`);
        }
      },
    };

    return (
      <Upload {...props}>
        <Button icon={<PictureOutlined />}>上传图片</Button>
      </Upload>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '图片上传，限制只能上传图片类型，最大 5MB',
      },
    },
  },
};

/**
 * 图片卡片上传
 */
export const ImageCard: Story = {
  render: () => {
    const props: UploadProps = {
      name: 'file',
      action: '/api/upload',
      listType: 'picture-card',
      accept: 'image/*',
      maxCount: 8,
      multiple: true,
      beforeUpload: (file) => {
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
          message.error('只能上传图片文件');
          return false;
        }
        const isLt10M = file.size / 1024 / 1024 < 10;
        if (!isLt10M) {
          message.error('图片大小不能超过 10MB');
          return false;
        }
        return true;
      },
    };

    return (
      <Upload {...props}>
        <div style={{ textAlign: 'center' }}>
          <PictureOutlined style={{ fontSize: 32, color: '#999' }} />
          <div style={{ marginTop: 8 }}>上传图片</div>
        </div>
      </Upload>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '图片卡片上传，支持多张图片，最多 8 张',
      },
    },
  },
};

/**
 * 拖拽上传
 */
export const Dragger: Story = {
  render: () => {
    const { Dragger } = Upload;

    const props: UploadProps = {
      name: 'file',
      multiple: true,
      action: '/api/upload',
      beforeUpload: (file) => {
        const isLt10M = file.size / 1024 / 1024 < 10;
        if (!isLt10M) {
          message.error('文件大小不能超过 10MB');
          return false;
        }
        return true;
      },
      onChange: (info) => {
        const { status } = info.file;
        if (status === 'done') {
          message.success(`${info.file.name} 上传成功`);
        } else if (status === 'error') {
          message.error(`${info.file.name} 上传失败`);
        }
      },
    };

    return (
      <Dragger {...props} style={{ width: 400 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持单个或批量上传，文件大小不超过 10MB
        </p>
      </Dragger>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '拖拽上传，支持点击和拖拽两种方式',
      },
    },
  },
};

/**
 * 手动上传
 */
export const Manual: Story = {
  render: () => {
    const [fileList, setFileList] = React.useState<any[]>([]);
    const [uploading, setUploading] = React.useState(false);

    const handleUpload = async () => {
      if (fileList.length === 0) {
        message.warning('请先选择文件');
        return;
      }

      setUploading(true);

      try {
        // 模拟上传
        await new Promise((resolve) => setTimeout(resolve, 2000));
        message.success('上传成功');
        setFileList([]);
      } catch (error) {
        message.error('上传失败');
      } finally {
        setUploading(false);
      }
    };

    const props: UploadProps = {
      onRemove: (file) => {
        const index = fileList.indexOf(file);
        const newFileList = fileList.slice();
        newFileList.splice(index, 1);
        setFileList(newFileList);
      },
      beforeUpload: (file) => {
        setFileList([...fileList, file]);
        return false; // 阻止自动上传
      },
      fileList,
    };

    return (
      <div>
        <Upload {...props}>
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
        <Button
          type="primary"
          onClick={handleUpload}
          disabled={fileList.length === 0}
          loading={uploading}
          style={{ marginTop: 16 }}
        >
          {uploading ? '上传中...' : '开始上传'}
        </Button>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '手动上传，选择文件后点击"开始上传"按钮上传',
      },
    },
  },
};

/**
 * 图片裁剪上传
 */
export const ImageCrop: Story = {
  render: () => {
    const props: UploadProps = {
      name: 'avatar',
      listType: 'picture-circle',
      action: '/api/upload',
      maxCount: 1,
      accept: 'image/*',
      beforeUpload: (file) => {
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
          message.error('只能上传图片文件');
          return false;
        }
        const isLt2M = file.size / 1024 / 1024 < 2;
        if (!isLt2M) {
          message.error('图片大小不能超过 2MB');
          return false;
        }
        return true;
      },
    };

    return (
      <Upload {...props}>
        <div style={{ textAlign: 'center' }}>
          <PictureOutlined style={{ fontSize: 32, color: '#999' }} />
          <div style={{ marginTop: 8 }}>上传头像</div>
        </div>
      </Upload>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '头像上传，圆形显示，最多 1 张',
      },
    },
  },
};

/**
 * 错误处理
 */
export const ErrorHandling: Story = {
  render: () => {
    const props: UploadProps = {
      name: 'file',
      action: '/api/upload',
      beforeUpload: (file) => {
        // 文件类型检查
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          message.error('只能上传 JPG、PNG、GIF、WebP 格式的图片');
          return Upload.LIST_IGNORE;
        }

        // 文件大小检查
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          message.error(`图片大小不能超过 5MB，当前文件：${(file.size / 1024 / 1024).toFixed(2)}MB`);
          return Upload.LIST_IGNORE;
        }

        return true;
      },
      onChange: (info) => {
        if (info.file.status === 'done') {
          message.success(`${info.file.name} 上传成功`);
        } else if (info.file.status === 'error') {
          message.error(`${info.file.name} 上传失败，请重试`);
        }
      },
    };

    return (
      <div>
        <Upload {...props} listType="picture">
          <Button icon={<UploadOutlined />}>上传图片</Button>
        </Upload>
        <div style={{ marginTop: 16, color: '#999', fontSize: 12 }}>
          <p>支持格式：JPG、PNG、GIF、WebP</p>
          <p>文件大小：最大 5MB</p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: '错误处理示例，包含文件类型和大小检查，提供友好的错误提示',
      },
    },
  },
};
