---
"@es-plus/core": minor
"@es-plus/vue3": minor
"@es-plus/vue2": minor
"@es-plus/adapter-antdv": minor
"@es-plus/shared": patch
"@es-plus/mcp-server": patch
---

移除 `DialogOptions.onSubmit` —— 该选项从未生效，请改用 `configBtn[].click`。

**这不是「删功能」，是承认该 API 不存在。** 三端没有任何一个 dialog 组件 emit `submit`：
vue3 声明了事件并写了一个**零引用**的 `handleConfirm`（唯一会 emit `submit` 的地方）；vue2 把
`'submit'` 列进了 `emits` 却从不 emit；antdv 连声明都没有。而三端 `useDialog` 合计 17 处在包装
`onSubmit`、4 个类型文件声明了它 —— 除最后一步外整条链都接好了，唯独没有触发点。

因此升级后：

- **运行时行为完全不变** —— 传 `onSubmit` 的代码本来就不会被调用（弹窗底部按钮只在 `configBtn`
  非空时渲染，写了 `onSubmit` 的调用其实一个按钮都没有）；
- **类型上会看到错误** —— `DialogOptions` 不再有该字段，这是本次唯一的破坏性变更，故记 minor。

迁移方式（把确认逻辑挂到按钮自己的 `click` 上）：

```ts
dialog({
  render: (h) => h(EsForm, { /* … */ }),
  configBtn: [
    { name: '取消', click: (_, { close }) => close() },
    {
      name: '确定',
      type: 'primary',
      click: (_, { close, getRefs }) => {
        getRefs('form')?.validate().then(() => close())
      }
    }
  ]
})
```

一并删除：三端 `useDialog` 里的 17 处包装、vue3 的 `submit` 事件声明与死代码 `handleConfirm`、
vue2 `emits` 里的 `'submit'`、`dialog-options.schema.json` 里的 `onSubmit`（已同步三份副本）、
`get_component_api` 中「exposed by the type but the runtime never wires it up」那条说明。

文档站的 4 处示例与 API 表已迁移到上述写法（迁移前这些「点击确定」的示例其实点不动，因为压根
没有按钮）。
