/**
 * Ant Design 图标映射表
 * 艹，这个tm把字符串图标名映射到实际的React组件！
 */

import type { ComponentType } from 'react';
import {
  // 通用图标
  HomeOutlined,
  UserOutlined,
  SettingOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
  CheckOutlined,
  MoreOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,

  // 导航图标
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LeftOutlined,
  RightOutlined,
  UpOutlined,
  DownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,

  // 文件和文档
  FileOutlined,
  FolderOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  DownloadOutlined,
  UploadOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,

  // 用户和权限
  TeamOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
  UserDeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  SafetyOutlined,
  KeyOutlined,

  // 数据和统计
  DashboardOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  DotChartOutlined,
  AreaChartOutlined,
  FundOutlined,
  StockOutlined,

  // 功能操作
  EyeOutlined,
  EyeInvisibleOutlined,
  CopyOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  LinkOutlined,
  ShareAltOutlined,
  ExportOutlined,
  ImportOutlined,
  PrinterOutlined,

  // 状态指示
  LoadingOutlined,
  SyncOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined as ExclamationCircle,

  // 消息和通知
  BellOutlined,
  NotificationOutlined,
  MessageOutlined,
  MailOutlined,
  CommentOutlined,

  // 设置和工具
  ToolOutlined,
  ApiOutlined,
  CodeOutlined,
  BugOutlined,
  RocketOutlined,
  ThunderboltOutlined,

  // 商业和支付
  ShoppingCartOutlined,
  ShoppingOutlined,
  WalletOutlined,
  CreditCardOutlined,
  DollarOutlined,
  EuroOutlined,
  GiftOutlined,
  TagOutlined,
  TagsOutlined,

  // 日期和时间
  CalendarOutlined,
  ScheduleOutlined,
  FieldTimeOutlined,
  HistoryOutlined,

  // 多媒体
  PlayCircleOutlined,
  PauseCircleOutlined,
  CameraOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  AudioOutlined,

  // 社交和分享
  HeartOutlined,
  StarOutlined,
  LikeOutlined,
  DislikeOutlined,

  // 表单相关
  FormOutlined,
  TableOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  DatabaseOutlined,

  // AI衣柜项目特定
  SkinOutlined,
  SmileOutlined,
  CrownOutlined,
  FireOutlined,
  TrophyOutlined,

  // 其他常用
  GlobalOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MobileOutlined,
  QrcodeOutlined,
  ScanOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';

/**
 * 图标映射表类型定义
 */
export type IconMapType = Record<string, ComponentType<any>>;

/**
 * 艹，这个大字典把所有常用图标都映射进来！
 * 后端只需要传字符串名称，前端自动渲染对应组件
 */
export const ICON_MAP: IconMapType = {
  // 通用图标
  HomeOutlined,
  UserOutlined,
  SettingOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SaveOutlined,
  CloseOutlined,
  CheckOutlined,
  MoreOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,

  // 导航图标
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LeftOutlined,
  RightOutlined,
  UpOutlined,
  DownOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,

  // 文件和文档
  FileOutlined,
  FolderOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  DownloadOutlined,
  UploadOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,

  // 用户和权限
  TeamOutlined,
  UserAddOutlined,
  UsergroupAddOutlined,
  UserDeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  SafetyOutlined,
  KeyOutlined,

  // 数据和统计
  DashboardOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  DotChartOutlined,
  AreaChartOutlined,
  FundOutlined,
  StockOutlined,

  // 功能操作
  EyeOutlined,
  EyeInvisibleOutlined,
  CopyOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  LinkOutlined,
  ShareAltOutlined,
  ExportOutlined,
  ImportOutlined,
  PrinterOutlined,

  // 状态指示
  LoadingOutlined,
  SyncOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircle,

  // 消息和通知
  BellOutlined,
  NotificationOutlined,
  MessageOutlined,
  MailOutlined,
  CommentOutlined,

  // 设置和工具
  ToolOutlined,
  ApiOutlined,
  CodeOutlined,
  BugOutlined,
  RocketOutlined,
  ThunderboltOutlined,

  // 商业和支付
  ShoppingCartOutlined,
  ShoppingOutlined,
  WalletOutlined,
  CreditCardOutlined,
  DollarOutlined,
  EuroOutlined,
  GiftOutlined,
  TagOutlined,
  TagsOutlined,

  // 日期和时间
  CalendarOutlined,
  ScheduleOutlined,
  FieldTimeOutlined,
  HistoryOutlined,

  // 多媒体
  PlayCircleOutlined,
  PauseCircleOutlined,
  CameraOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  AudioOutlined,

  // 社交和分享
  HeartOutlined,
  StarOutlined,
  LikeOutlined,
  DislikeOutlined,

  // 表单相关
  FormOutlined,
  TableOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  DatabaseOutlined,

  // AI衣柜项目特定
  SkinOutlined,
  SmileOutlined,
  CrownOutlined,
  FireOutlined,
  TrophyOutlined,

  // 其他常用
  GlobalOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MobileOutlined,
  QrcodeOutlined,
  ScanOutlined,
  BarcodeOutlined,
};

/**
 * 获取图标组件
 * 艹，找不到就返回默认图标，不能让页面崩溃！
 */
export function getIconComponent(iconName: string | undefined | null): ComponentType<any> | null {
  if (!iconName) {
    return null;
  }

  return ICON_MAP[iconName] || null;
}

/**
 * 检查图标是否存在
 */
export function hasIcon(iconName: string): boolean {
  return iconName in ICON_MAP;
}

/**
 * 获取所有可用图标名称列表
 */
export function getAvailableIcons(): string[] {
  return Object.keys(ICON_MAP);
}
