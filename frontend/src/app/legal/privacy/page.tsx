'use client';

/**
 * 隐私政策页面
 * 艹！法律合规必备页面！
 *
 * @author 老王
 */

import React from 'react';
import { Typography, Card, Anchor } from 'antd';

const { Title, Paragraph, Text } = Typography;
const { Link } = Anchor;

export default function PrivacyPolicyPage() {
  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Card>
        <Title level={2}>隐私政策</Title>
        <Text type="secondary">最后更新: 2025-11-04</Text>

        <div style={{ marginTop: 32 }}>
          <Title level={3} id="intro">1. 引言</Title>
          <Paragraph>
            欢迎使用我们的服务。我们重视您的隐私，并致力于保护您的个人信息。本隐私政策说明了我们如何收集、使用、披露和保护您的信息。
          </Paragraph>

          <Title level={3} id="collection">2. 信息收集</Title>
          <Paragraph>
            <Title level={4}>2.1 我们收集的信息</Title>
            <ul>
              <li><Text strong>账户信息</Text>：姓名、电子邮件地址、电话号码</li>
              <li><Text strong>使用数据</Text>：IP地址、浏览器类型、访问时间</li>
              <li><Text strong>内容数据</Text>：您创建的模板、Prompt等</li>
              <li><Text strong>支付信息</Text>：通过第三方支付处理（我们不存储完整卡号）</li>
            </ul>
          </Paragraph>

          <Title level={3} id="usage">3. 信息使用</Title>
          <Paragraph>
            我们使用收集的信息用于：
            <ul>
              <li>提供和维护服务</li>
              <li>改进用户体验</li>
              <li>发送服务通知和更新</li>
              <li>处理支付和防止欺诈</li>
              <li>遵守法律义务</li>
            </ul>
          </Paragraph>

          <Title level={3} id="sharing">4. 信息共享</Title>
          <Paragraph>
            我们不会出售您的个人信息。我们可能与以下方共享信息：
            <ul>
              <li>服务提供商（云存储、支付处理）</li>
              <li>法律要求（遵守法律、法规或法律程序）</li>
              <li>业务转让（合并、收购等情况）</li>
            </ul>
          </Paragraph>

          <Title level={3} id="security">5. 数据安全</Title>
          <Paragraph>
            我们采取以下措施保护您的数据：
            <ul>
              <li>加密传输（HTTPS/TLS）</li>
              <li>加密存储（AES-256）</li>
              <li>访问控制和身份验证</li>
              <li>定期安全审计</li>
              <li>员工培训</li>
            </ul>
          </Paragraph>

          <Title level={3} id="rights">6. 您的权利</Title>
          <Paragraph>
            根据GDPR和其他适用法律，您有权：
            <ul>
              <li><Text strong>访问</Text>：请求访问您的个人信息</li>
              <li><Text strong>更正</Text>：更正不准确的信息</li>
              <li><Text strong>删除</Text>：请求删除您的信息（&ldquo;被遗忘权&rdquo;）</li>
              <li><Text strong>导出</Text>：以机器可读格式导出数据</li>
              <li><Text strong>反对</Text>：反对某些数据处理</li>
              <li><Text strong>撤回同意</Text>：随时撤回您的同意</li>
            </ul>
          </Paragraph>

          <Title level={3} id="cookies">7. Cookie和追踪技术</Title>
          <Paragraph>
            我们使用Cookie和类似技术来：
            <ul>
              <li>保持您的登录状态</li>
              <li>记住您的偏好设置</li>
              <li>分析使用情况</li>
              <li>提供个性化内容</li>
            </ul>
            您可以通过浏览器设置管理Cookie。
          </Paragraph>

          <Title level={3} id="children">8. 儿童隐私</Title>
          <Paragraph>
            我们的服务不面向13岁以下儿童。如果我们发现收集了儿童信息，我们会立即删除。
          </Paragraph>

          <Title level={3} id="changes">9. 政策变更</Title>
          <Paragraph>
            我们可能会更新本隐私政策。重大变更时，我们会通过电子邮件或网站通知您。
          </Paragraph>

          <Title level={3} id="contact">10. 联系我们</Title>
          <Paragraph>
            如有隐私相关问题，请联系：
            <ul>
              <li>邮箱: privacy@example.com</li>
              <li>地址: 中国北京市朝阳区xxx街道xxx号</li>
            </ul>
          </Paragraph>
        </div>
      </Card>

      {/* 锚点导航 */}
      <Anchor
        style={{ position: 'fixed', top: 100, right: 24 }}
        items={[
          { key: 'intro', href: '#intro', title: '引言' },
          { key: 'collection', href: '#collection', title: '信息收集' },
          { key: 'usage', href: '#usage', title: '信息使用' },
          { key: 'sharing', href: '#sharing', title: '信息共享' },
          { key: 'security', href: '#security', title: '数据安全' },
          { key: 'rights', href: '#rights', title: '您的权利' },
          { key: 'cookies', href: '#cookies', title: 'Cookie' },
          { key: 'children', href: '#children', title: '儿童隐私' },
          { key: 'changes', href: '#changes', title: '政策变更' },
          { key: 'contact', href: '#contact', title: '联系我们' },
        ]}
      />
    </div>
  );
}
