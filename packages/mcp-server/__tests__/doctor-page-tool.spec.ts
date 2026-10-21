import { describe, it, expect } from "vitest";
import { registerDoctorPage } from "../src/tools/doctor-page.js";

// doctor_page 的 `config` 决定「哪些前置项按需要检查」。形状错了会让 preflight 把
// 权限/翻译门判成「不需要」—— 报告全 ok，是比报错更危险的失败方向（permission
// 缺失时失败方向是放行）。这里钉住「config 形状不可读 = 工具失败（isError）」，
// 同时钉住「部分配置照常可用」—— 不要为了堵假绿把合法用法一起拒掉。

type Captured = { desc: string; shape: any; handler: (args: any) => any };

function makeMockServer() {
  const tools: Record<string, Captured> = {};
  const server = {
    tool(name: string, desc: string, shape: any, handler: (args: any) => any) {
      tools[name] = { desc, shape, handler };
    },
  };
  return { server: server as any, tools };
}

function doctorHandler() {
  const { server, tools } = makeMockServer();
  registerDoctorPage(server);
  expect(tools.doctor_page).toBeDefined();
  return tools.doctor_page.handler;
}

const ENTRY = `import { createApp } from 'vue'
import ESPlus from '@es-plus/vue3'
const app = createApp(App)
app.use(ESPlus, { httpRequest, permission: () => true, t: (k: string) => k })
app.mount('#app')
`;

const FULL_CONFIG = {
  name: "UserManage",
  apiUrl: "/api/users",
  target: "vue3",
  mode: "schema",
  actions: ["query"],
  fields: [{ prop: "status", label: "状态", formtype: "Select", permissionValue: "user:read" }],
};

// 既有用法：只传 preflight 关心的那几项（没有 name/apiUrl）。
const PARTIAL_CONFIG = {
  target: "vue3",
  mode: "schema",
  actions: ["add"],
  fields: [{ prop: "name", label: "名称", formtype: "Input", permissionValue: "user:add" }],
};

describe("doctor_page — config 形状校验（不许假绿灯）", () => {
  it("完整 config → 正常出报告", async () => {
    const r = await doctorHandler()({ entry: ENTRY, target: "vue3", config: FULL_CONFIG });
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toContain("Doctor");
  });

  it("省略 config → 一律按需要检查", async () => {
    const r = await doctorHandler()({ entry: ENTRY });
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toContain("Doctor");
  });

  it("部分配置（无 name/apiUrl）不得被判非法 —— preflight 只读载体", async () => {
    const r = await doctorHandler()({ entry: ENTRY, target: "vue3", config: PARTIAL_CONFIG });
    expect(r.isError).toBeFalsy();
    expect(r.content[0].text).toContain("Doctor");
  });

  it("dialogs.add: null（前门可修复的输入形态）照常可用", async () => {
    const r = await doctorHandler()({
      entry: ENTRY,
      target: "vue3",
      config: { ...PARTIAL_CONFIG, dialogs: { add: null, edit: { formItems: [] } } },
    });
    expect(r.isError).toBeFalsy();
  });

  it("顶层形状错（fields 是字符串）→ isError，且不输出报告", async () => {
    const r = await doctorHandler()({
      entry: ENTRY,
      config: { ...FULL_CONFIG, fields: "status,userName" },
    });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("doctor did NOT run");
    expect(r.content[0].text).toContain("/fields");
    expect(r.content[0].text).not.toContain("Doctor — host entry check");
  });

  it("嵌套形状错（columns[].btns 是字符串 / dialogs.edit 是字符串）→ 逐条点名路径", async () => {
    const r = await doctorHandler()({
      entry: ENTRY,
      config: {
        ...FULL_CONFIG,
        columns: [{ prop: "name", btns: "edit" }],
        dialogs: { edit: "oops" },
      },
    });
    expect(r.isError).toBe(true);
    const text = r.content[0].text;
    expect(text).toContain("/columns/0/btns");
    expect(text).toContain("/dialogs/edit");
  });

  it("config 不是对象（字符串 / 数组）→ isError", async () => {
    for (const bad of ["{}", [], 42]) {
      const r = await doctorHandler()({ entry: ENTRY, config: bad });
      expect(r.isError).toBe(true);
    }
  });
});
