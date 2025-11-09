'use client';

/**
 * 服务条款页面
 * 艹！法律合规必备页面！
 *
 * @author 老王
 */

import React from 'react';
import { Typography, Card } from 'antd';

const { Title, Paragraph, Text } = Typography;

export default function TermsOfServicePage() {
  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Card>
        <Title level={2}>服务条款</Title>
        <Text type="secondary">最后更新: 2025-11-04</Text>

        <div style={{ marginTop: 32 }}>
          <Title level={3}>1. 接受条款</Title>
          <Paragraph>
            通过访问和使用本服务，您同意遵守这些服务条款。如果您不同意这些条款，请不要使用本服务。
          </Paragraph>

          <Title level={3}>2. 服务描述</Title>
          <Paragraph>
            我们提供AI辅助的内容创作和管理平台，包括但不限于模板管理、AI生成、数据分析等功能。
          </Paragraph>

          <Title level={3}>3. 用户账户</Title>
          <Paragraph>
            <ul>
              <li>您必须年满18岁才能创建账户</li>
              <li>您有责任维护账户安全</li>
              <li>您对账户下的所有活动负责</li>
              <li>禁止共享账户凭证</li>
            </ul>
          </Paragraph>

          <Title level={3}>4. 可接受的使用</Title>
          <Paragraph>
            <Text strong>禁止以下行为：</Text>
            <ul>
              <li>违反法律法规</li>
              <li>侵犯他人知识产权</li>
              <li>传播恶意软件</li>
              <li>进行未经授权的访问</li>
              <li>滥用服务资源</li>
              <li>骚扰其他用户</li>
            </ul>
          </Paragraph>

          <Title level={3}>5. 知识产权</Title>
          <Paragraph>
            <ul>
              <li>服务的所有权和知识产权归我们所有</li>
              <li>您保留您创建内容的所有权</li>
              <li>您授予我们使用您内容的许可以提供服务</li>
            </ul>
          </Paragraph>

          <Title level={3}>6. 付费服务</Title>
          <Paragraph>
            <ul>
              <li>某些功能需要付费订阅</li>
              <li>费用在订阅时明确显示</li>
              <li>自动续订可随时取消</li>
              <li>退款政策: 7天内可全额退款</li>
            </ul>
          </Paragraph>

          <Title level={3}>7. 服务变更和终止</Title>
          <Paragraph>
            我们保留随时修改或终止服务的权利。重大变更时会提前通知用户。
          </Paragraph>

          <Title level={3}>8. 免责声明</Title>
          <Paragraph>
            服务按&ldquo;原样&rdquo;提供，不提供任何明示或暗示的保证。我们不对服务中断、数据丢失或其他损失负责。
          </Paragraph>

          <Title level={3}>9. 责任限制</Title>
          <Paragraph>
            在适用法律允许的最大范围内，我们对任何间接、偶然、特殊或后果性损害不承担责任。
          </Paragraph>

          <Title level={3}>10. 争议解决</Title>
          <Paragraph>
            本条款受中华人民共和国法律管辖。任何争议应首先通过友好协商解决，协商不成提交北京仲裁委员会仲裁。
          </Paragraph>

          <Title level={3}>11. 联系方式</Title>
          <Paragraph>
            如有问题，请联系: legal@example.com
          </Paragraph>
        </div>
      </Card>
    </div>
  );
}
