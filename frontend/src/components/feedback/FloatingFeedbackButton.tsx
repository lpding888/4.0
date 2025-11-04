'use client';

/**
 * 浮动反馈按钮
 * 艹！这个按钮固定在页面右下角，让用户随时提交反馈！
 *
 * @author 老王
 */

import React, { useState } from 'react';
import { FloatButton, Badge } from 'antd';
import { MessageOutlined, CommentOutlined } from '@ant-design/icons';
import { FeedbackModal } from './FeedbackModal';

/**
 * FloatingFeedbackButton Props
 */
interface FloatingFeedbackButtonProps {
  /**
   * 是否显示未读消息数
   */
  showBadge?: boolean;

  /**
   * 未读消息数
   */
  badgeCount?: number;

  /**
   * 按钮距离底部的距离（px）
   */
  bottom?: number;

  /**
   * 按钮距离右边的距离（px）
   */
  right?: number;
}

/**
 * 浮动反馈按钮
 */
export const FloatingFeedbackButton: React.FC<FloatingFeedbackButtonProps> = ({
  showBadge = false,
  badgeCount = 0,
  bottom = 24,
  right = 24,
}) => {
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);

  /**
   * 打开反馈Modal
   */
  const handleOpenFeedback = () => {
    setFeedbackModalVisible(true);
  };

  /**
   * 关闭反馈Modal
   */
  const handleCloseFeedback = () => {
    setFeedbackModalVisible(false);
  };

  return (
    <>
      {/* 浮动按钮 */}
      <FloatButton
        icon={showBadge && badgeCount > 0 ? <Badge count={badgeCount} offset={[0, 0]}><CommentOutlined /></Badge> : <CommentOutlined />}
        type="primary"
        style={{
          bottom,
          right,
          width: 56,
          height: 56,
        }}
        onClick={handleOpenFeedback}
        tooltip="用户反馈"
      />

      {/* 反馈Modal */}
      <FeedbackModal
        open={feedbackModalVisible}
        onClose={handleCloseFeedback}
      />
    </>
  );
};
