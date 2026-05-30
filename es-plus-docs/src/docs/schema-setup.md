# IDE 配置自动补全（JSON Schema）

ES-Plus 公开了 `formItemList` 与 `columns` 的 JSON Schema，配置到 IDE 后，写表单/表格的 JSON 配置时可以获得：

- ✨ 字段名/类型补全
- ⚠️ 错误属性即时高亮
- 📚 鼠标悬停查看属性说明

文档站托管的 schema URL 如下：

| 用途 | URL |
| --- | --- |
| EsForm `formItemList` | `https://es-plus.dev/schemas/es-form.schema.json` |
| EsTable `columns` | `https://es-plus.dev/schemas/es-table-columns.schema.json` |
| EsTable `dataSource` | `https://es-plus.dev/schemas/es-table-data.schema.json` |

> 自托管文档时把 `https://es-plus.dev` 替换为实际部署域名即可。

---

## VSCode

在项目根目录创建 `.vscode/settings.json`（已存在则合并 `json.schemas` 字段）：

```json
{
  "json.schemas": [
    {
      "fileMatch": ["**/*.es-form.json", "**/form-config.json"],
      "url": "https://es-plus.dev/schemas/es-form.schema.json"
    },
    {
      "fileMatch": ["**/*.es-table.json", "**/columns.config.json"],
      "url": "https://es-plus.dev/schemas/es-table-columns.schema.json"
    }
  ]
}
```

匹配的 `.json` 文件会自动启用补全。例如 `src/configs/user.es-form.json`：

```json
[
  {
    "prop": "name",
    "label": "姓名",
    "formtype": "Input",
    "span": 12
  }
]
```

输入 `formtype` 时会弹出 `Input | Select | DatePicker | ...` 下拉。

---

## JetBrains（WebStorm / IntelliJ IDEA）

### 方式 A：UI 配置

1. **Settings → Languages & Frameworks → Schemas and DTDs → JSON Schema Mappings**
2. 点击 `+` 添加：
   - **Name**: `es-form`
   - **Schema URL**: `https://es-plus.dev/schemas/es-form.schema.json`
   - **Schema version**: `JSON Schema Version 7`
   - **File path pattern**: `*.es-form.json`
3. 重复一遍配置 `es-table-columns`。

### 方式 B：项目配置文件

在项目根目录创建 `.idea/jsonSchemas.xml`（提交进 Git 后团队共享）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="JsonSchemaMappingsProjectConfiguration">
    <state>
      <map>
        <entry key="es-form">
          <value>
            <SchemaInfo>
              <option name="name" value="es-form" />
              <option name="relativePathToSchema" value="https://es-plus.dev/schemas/es-form.schema.json" />
              <option name="schemaVersion" value="JSON_SCHEMA_VERSION_7" />
              <option name="patterns">
                <list>
                  <Item>
                    <option name="path" value="*.es-form.json" />
                  </Item>
                </list>
              </option>
            </SchemaInfo>
          </value>
        </entry>
      </map>
    </state>
  </component>
</project>
```

---

## 在 .ts / .vue 里也想要补全？

JSON Schema 只对 `.json` 生效。在 `.ts` / `.vue` 里直接 import 类型即可：

```ts
import type { LayoutFormItemConfig, EsTableColumn } from 'es-plus'

const formItems: LayoutFormItemConfig[] = [
  { prop: 'name', label: '姓名', formtype: 'Input', span: 12 }
]

const columns: EsTableColumn[] = [
  { prop: 'name', label: '姓名', width: 120 }
]
```

TypeScript 自带补全 + 校验，比 JSON Schema 更精确。**JSON Schema 适用场景**：

- 配置由后端下发 / 动态生成
- 低代码平台运行时存储为 JSON
- 非 TS 项目（纯 JS 或 Vue 2 + 旧版 ts-loader）

---

## 进阶：用 `$schema` 字段替代全局映射

如果你不想配 IDE，可以在 JSON 文件首行声明 `$schema`，VSCode / WebStorm 都识别（前提是 JSON 是对象，不能直接对数组生效；可包一层）：

```json
{
  "$schema": "https://es-plus.dev/schemas/es-form.schema.json",
  "items": [
    { "prop": "name", "label": "姓名", "formtype": "Input" }
  ]
}
```

> 注：ES-Plus schema 顶层是 `array`，`$schema` 字段只在对象顶层有效。如需此用法，请把数组包到 `{ items: [...] }` 中并自行解构。

---

## 反馈

若发现某个属性没有补全或类型描述不准确，请到 [ES-Plus GitHub Issues](https://github.com/jiaaowuhan/es-plus/issues) 反馈。Schema 维护在 [`packages/vue3/src/types/index.ts`](https://github.com/jiaaowuhan/es-plus/blob/master/packages/vue3/src/types/index.ts) 与 docs 站 [`src/schemas/`](https://github.com/jiaaowuhan/es-plus/tree/master/es-plus-docs/src/schemas) 同步。
