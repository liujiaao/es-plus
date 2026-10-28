/**
 * 站点自己模板里用到的 Ant Design Vue 组件 —— **只有这些会被打进产物**。
 *
 * 这里曾经是 `app.use(Antd)`（全量注册，397.2 KB gz 里有一部分是它）。站点自己的模板
 * 只用到下面这 26 组标签，其余组件跟着每一页下载；而 `@es-plus/adapter-antdv` 的组件
 * 内部是直接 `import { Table } from 'ant-design-vue'` 的，从不依赖全局注册。
 *
 * 与主站 es-plus-docs 的 `utils/install-app-plugins.ts`（Element Plus 显式清单）同构，
 * 有一处**实质差别**：ADV 的每个组件带 `install()`，它会把子组件一起注册
 * （`Menu` → `a-menu-item` / `a-sub-menu`，`Select` → `a-select-option`，
 * `Layout` → `a-layout-header` / `a-layout-sider` / `a-layout-content` ……），
 * 所以这里注册的是**组名**而不是标签名，少一个组名就是「整块菜单/整张表消失」。
 *
 * 失败模式是「页面看起来正常、某个组件突然不渲染」，所以维护它不能靠人：
 * `npm run check:bundle-sources` 会扫全部 `.vue` 模板里的 `<a-xxx>` 标签，
 * 逐个映射到这张表，**有一个映射不到就红**。新增标签时把它的组名加进来，
 * 别改回 `app.use(Antd)`。
 *
 * 省下的没有主站那 80.8 KB 多：`@es-plus/adapter-antdv` 的 Table / Pagination / Spin /
 * ConfigProvider / Button / Tooltip / Tag / Modal / Space 本来就在首屏里（实测把
 * `app.use(Antd)` 整个删掉，`vendor-antd` 仍有 310.1 KB gz），站点侧只能减掉
 * 「库和示例都没用到、只有站点模板用到」的那部分。
 */
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  ConfigProvider,
  Descriptions,
  Divider,
  Dropdown,
  Empty,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue'

export const ANT_DESIGN_VUE_COMPONENTS = {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  ConfigProvider,
  Descriptions,
  Divider,
  Dropdown,
  Empty,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Progress,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
}

/** 把清单里的组件逐个注册到 app（每个组件自带的 install 会连子组件一起注册） */
export function installAntd(app) {
  for (const component of Object.values(ANT_DESIGN_VUE_COMPONENTS)) {
    app.use(component)
  }
}
