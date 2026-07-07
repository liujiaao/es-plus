/**
 * Ant Design Vue 图标适配
 *
 * Element Plus 使用组件式图标（<Plus />），ADV 也使用组件式图标（@ant-design/icons-vue）。
 * 两者都是组件式，但图标名称不同。此模块提供 EP 图标名 → ADV 图标组件的映射。
 */
import * as Icons from '@ant-design/icons-vue'
import { h } from 'vue'
import type { VNode } from 'vue'

/**
 * EP 图标名 → ADV 图标名 映射表
 */
const ICON_NAME_MAP: Record<string, string> = {
  // 方向类
  ArrowDown: 'DownOutlined',
  ArrowUp: 'UpOutlined',
  ArrowLeft: 'LeftOutlined',
  ArrowRight: 'RightOutlined',
  CaretTop: 'CaretUpOutlined',
  CaretBottom: 'CaretDownOutlined',
  // 操作类
  Plus: 'PlusOutlined',
  Close: 'CloseOutlined',
  Check: 'CheckOutlined',
  Search: 'SearchOutlined',
  Edit: 'EditOutlined',
  Delete: 'DeleteOutlined',
  View: 'EyeOutlined',
  Refresh: 'ReloadOutlined',
  Tools: 'ToolOutlined',
  Setting: 'SettingOutlined',
  // 导航类
  Home: 'HomeOutlined',
  Back: 'ArrowLeftOutlined',
  // 文件/数据类
  Download: 'DownloadOutlined',
  Upload: 'UploadOutlined',
  CopyDocument: 'CopyOutlined',
  Document: 'FileOutlined',
  Folder: 'FolderOutlined',
  Files: 'FileTextOutlined',
  Picture: 'PictureOutlined',
  VideoCamera: 'VideoCameraOutlined',
  // 状态类
  FullScreen: 'FullscreenOutlined',
  Loading: 'LoadingOutlined',
  Warning: 'WarningOutlined',
  Info: 'InfoCircleOutlined',
  WarningFilled: 'WarningFilled',
  CircleCheckFilled: 'CheckCircleFilled',
  CircleCloseFilled: 'CloseCircleFilled',
  // 用户类
  User: 'UserOutlined',
  UserFilled: 'UserOutlined',
  // 其他常用
  Menu: 'MenuOutlined',
  Expand: 'ExpandOutlined',
  Fold: 'CompressOutlined',
  Filter: 'FilterOutlined',
  Printer: 'PrinterOutlined',
  Share: 'ShareAltOutlined',
  Link: 'LinkOutlined',
  Unlink: 'DisconnectOutlined',
  Lock: 'LockOutlined',
  Unlock: 'UnlockOutlined',
  Bell: 'BellOutlined',
  Message: 'MessageOutlined',
  ChatDotSquare: 'MessageOutlined',
  Calendar: 'CalendarOutlined',
  Clock: 'ClockCircleOutlined',
  Location: 'EnvironmentOutlined',
  Phone: 'PhoneOutlined',
  MessageFilled: 'MessageFilled',
  Star: 'StarOutlined',
  StarFilled: 'StarFilled',
}

/**
 * 根据 EP 图标名获取 ADV 图标 VNode
 * @param iconName EP 图标名（PascalCase，如 'ArrowDown', 'Plus'）
 * @param size 图标大小
 * @returns VNode 或 null
 */
export function getAdvIcon(iconName: string, size: number = 14): VNode | null {
  if (!iconName) return null

  // 1. 尝试映射表
  const advName = ICON_NAME_MAP[iconName]
  if (advName && (Icons as any)[advName]) {
    return h((Icons as any)[advName], { style: { fontSize: `${size}px` } })
  }

  // 2. 尝试直接匹配 ADV 图标名
  if ((Icons as any)[iconName]) {
    return h((Icons as any)[iconName], { style: { fontSize: `${size}px` } })
  }

  // 3. 尝试加 Outlined 后缀
  const outlined = `${iconName}Outlined`
  if ((Icons as any)[outlined]) {
    return h((Icons as any)[outlined], { style: { fontSize: `${size}px` } })
  }

  // 4. 返回空
  return null
}

/**
 * 获取 ADV 图标组件类（用于模板 :is）
 * @param iconName EP 图标名或 ADV 图标名
 * @returns 组件构造函数或 undefined
 */
export function getAdvIconComponent(iconName: string): any {
  if (!iconName) return undefined
  const advName = ICON_NAME_MAP[iconName]
  if (advName && (Icons as any)[advName]) {
    return (Icons as any)[advName]
  }
  if ((Icons as any)[iconName]) {
    return (Icons as any)[iconName]
  }
  const outlined = `${iconName}Outlined`
  if ((Icons as any)[outlined]) {
    return (Icons as any)[outlined]
  }
  return undefined
}
