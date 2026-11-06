import { describe, it, expect } from "vitest";
import {
  COVERAGE_CONTRACT_VERSION,
  COVERAGE_LEVELS,
  COVERAGE_LEVEL_MEANING,
  classifyCoverage,
} from "../src/scene/coverage.js";

/**
 * P13 —— 逐页覆盖分级。
 *
 * 判据只来自 P9 能力台账 + 宿主清单自己的声明（多部分 / 扩展点 / 自有代码）：
 * 同一份清单重跑必得同一结果。这里逐条钉住「什么条件落在哪一级」以及汇总计数。
 */

const field = (prop: string, label: string, formtype = "Input") => ({ prop, label, formtype });

const crudIntent = (over: Record<string, unknown> = {}) => ({
  name: "UserManage",
  apiUrl: "/api/users",
  surfaces: {
    query: [field("userName", "用户名")],
    table: [field("userName", "用户名")],
    form: [field("userName", "用户名")],
  },
  ...over,
});

const levelOf = (report: ReturnType<typeof classifyCoverage>, index = 0) => report.pages[index].level;

describe("classifyCoverage — L1 直出", () => {
  it("单部分、全部 accepted → L1", () => {
    const report = classifyCoverage({ pages: [{ name: "UserManage", scene: "crud", intent: crudIntent() }] });
    expect(report.contract).toBe(COVERAGE_CONTRACT_VERSION);
    expect(report.levels).toEqual(COVERAGE_LEVELS);
    expect(report.levelsMeaning.L2).toContain("extension points");
    expect(report.inventoryErrors).toEqual([]);
    expect(levelOf(report)).toBe("L1");
    expect(report.pages[0].reasons).toEqual([]);
    expect(report.pages[0].parts[0]).toMatchObject({ scene: "crud", ok: true, degraded: [] });
    expect(report.summary).toEqual({ L1: 1, L2: 0, L3: 0 });
  });

  it("parts[] 与 { scene, intent } 简写等价", () => {
    const short = classifyCoverage({ pages: [{ name: "P", scene: "crud", intent: crudIntent() }] });
    const long = classifyCoverage({
      pages: [{ name: "P", parts: [{ scene: "crud", intent: crudIntent() }] }],
    });
    expect(short.pages[0].level).toBe(long.pages[0].level);
    expect(short.pages[0].parts).toEqual(long.pages[0].parts);
  });
});

describe("classifyCoverage — L2 直出 + 扩展点", () => {
  it("降级键（sfc + 弹窗）→ L2，并说明哪个键没保真", () => {
    const intent = crudIntent({
      mode: "sfc",
      surfaces: {
        table: [field("userName", "用户名")],
        dialog: ["add"],
      },
    });
    const report = classifyCoverage({ pages: [{ name: "P", scene: "crud", intent }] });
    expect(levelOf(report)).toBe("L2");
    expect(report.pages[0].parts[0].degraded).toContain("surfaces");
    expect(report.pages[0].reasons.join("\n")).toContain("degraded key");
  });

  it("一页多个片段 → L2（需要 composition 接线）", () => {
    const report = classifyCoverage({
      pages: [
        {
          name: "MasterDetail",
          parts: [
            { scene: "table", intent: { fields: [field("id", "ID")] } },
            { scene: "form", intent: { fields: [field("name", "名称")] } },
          ],
        },
      ],
    });
    expect(levelOf(report)).toBe("L2");
    expect(report.pages[0].reasons.join("\n")).toContain("generate_composition");
  });

  it("宿主显式声明扩展点 → L2", () => {
    const report = classifyCoverage({
      pages: [
        {
          name: "P",
          scene: "crud",
          intent: crudIntent(),
          extensionPoints: [{ kind: "slot", where: "toolbar" }],
        },
      ],
    });
    expect(levelOf(report)).toBe("L2");
    expect(report.pages[0].reasons.join("\n")).toContain("extension point");
  });
});

describe("classifyCoverage — L3 需宿主代码", () => {
  it("unsupported 键 → L3", () => {
    const report = classifyCoverage({
      pages: [{ name: "P", scene: "crud", intent: crudIntent({ workflow: {} }) }],
    });
    expect(levelOf(report)).toBe("L3");
    expect(report.pages[0].parts[0].unsupported).toEqual(["workflow"]);
    expect(report.pages[0].reasons.join("\n")).toContain("unsupported key");
  });

  it("缺必填键 → L3（按声明发射不出来）", () => {
    const report = classifyCoverage({
      pages: [{ name: "P", scene: "crud", intent: { surfaces: { table: [field("a", "A")] } } }],
    });
    expect(levelOf(report)).toBe("L3");
    expect(report.pages[0].parts[0].missing).toEqual(expect.arrayContaining(["name", "apiUrl"]));
  });

  it("未知场景 → L3", () => {
    const report = classifyCoverage({ pages: [{ name: "P", scene: "dashboard", intent: {} }] });
    expect(levelOf(report)).toBe("L3");
    expect(report.pages[0].reasons.join("\n")).toContain("unknown scene");
  });

  it("没有 parts → L3", () => {
    const report = classifyCoverage({ pages: [{ name: "Empty" }] });
    expect(levelOf(report)).toBe("L3");
    expect(report.pages[0].reasons.join("\n")).toContain("no parts");
  });

  it("宿主声明自有代码 → L3（即使意图本身可直出）", () => {
    const report = classifyCoverage({
      pages: [{ name: "P", scene: "crud", intent: crudIntent(), hostCode: [{ kind: "chart-widget" }] }],
    });
    expect(levelOf(report)).toBe("L3");
    expect(report.pages[0].reasons.join("\n")).toContain("host-code");
  });
});

describe("classifyCoverage — 人工标注样本（P13 验收）", () => {
  /**
   * 验收口径：拿一份「人读触发条件表先标级、再看代码怎么判」的样本比对一致性。
   * 标注**不**从实现抄来 —— 每条的期望级别写在这里，判错时断言会点名页名。
   *
   * 注意三条反直觉但按台账成立的标注：
   *  - 无表格页仍必须声明 `name` / `apiUrl`（场景 required），而片段分支里
   *    `name` 没有载体 → `name` 降级；`apiUrl` 只有页面含弹窗时才有载体。
   *    但这类**元数据降级**不改变页面渲染，也不需要宿主接线 ⟹ 仍是 L1。
   *  - 宿主声明 `hostCode` 时即使意图本身可直出，也是 L3：那部分必须由宿主写。
   *  - 形状不合法（`surfaces.table` 不是数组）不是「降级直出」：调用方传入
   *    `validatePart` 时必须判 L3。
   */
  const samples: ReadonlyArray<{
    name: string
    page: Record<string, unknown>
    expected: "L1" | "L2" | "L3"
    why: string
  }> = [
    {
      name: "UserManage",
      expected: "L1",
      why: "单部分 CRUD，全部键 accepted",
      page: {
        name: "UserManage",
        scene: "crud",
        intent: crudIntent({ surfaces: {
          query: [field("userName", "用户名"), field("status", "状态", "Select")],
          table: [field("userName", "用户名"), field("status", "状态", "Select")],
          form: [field("userName", "用户名"), field("status", "状态", "Select")],
          dialog: ["add", "edit", "view"],
        } }),
      },
    },
    {
      name: "OrderLedger",
      expected: "L1",
      why: "只读台账：query+table，无 form / dialog",
      page: {
        name: "OrderLedger",
        scene: "crud",
        intent: crudIntent({ surfaces: {
          query: [field("orderNo", "订单号")],
          table: [field("orderNo", "订单号"), field("amount", "金额", "InputNumber")],
        } }),
      },
    },
    {
      name: "EmployeeSearch",
      expected: "L1",
      why: "无表格 → 片段分支，name/apiUrl/mode 只是无载体元数据，页面直接可发",
      page: {
        name: "EmployeeSearch",
        scene: "crud",
        intent: crudIntent({ surfaces: { query: [field("hiredAt", "入职日期", "DatePicker")] } }),
      },
    },
    {
      name: "FeedbackDialog",
      expected: "L1",
      why: "无表格弹窗页：apiUrl 有载体，name 无载体但不需要宿主编辑",
      page: {
        name: "FeedbackDialog",
        scene: "crud",
        intent: crudIntent({ surfaces: {
          dialog: [{ key: "feedback", title: "意见反馈", formItems: [field("content", "反馈内容")] }],
        } }),
      },
    },
    {
      name: "MasterDetail",
      expected: "L2",
      why: "一页两个片段 → 需要 generate_composition 接线",
      page: {
        name: "MasterDetail",
        parts: [
          { scene: "table", intent: { fields: [field("id", "ID")] } },
          { scene: "form", intent: { fields: [field("name", "名称")] } },
        ],
      },
    },
    {
      name: "UserManageWithSlot",
      expected: "L2",
      why: "宿主声明工具栏扩展点",
      page: {
        name: "UserManageWithSlot",
        scene: "crud",
        intent: crudIntent(),
        extensionPoints: [{ kind: "slot", where: "toolbar" }],
      },
    },
    {
      name: "UserManageSfc",
      expected: "L2",
      why: "sfc + 弹窗：surfaces 键降级",
      page: {
        name: "UserManageSfc",
        scene: "crud",
        intent: crudIntent({ mode: "sfc", surfaces: { table: [field("userName", "用户名")], dialog: ["add"] } }),
      },
    },
    {
      name: "Dashboard",
      expected: "L3",
      why: "宿主声明自有图表代码",
      page: {
        name: "Dashboard",
        scene: "crud",
        intent: crudIntent(),
        hostCode: [{ kind: "chart-widget" }],
      },
    },
    {
      name: "ApprovalCenter",
      expected: "L3",
      why: "工作流键不归任何场景",
      page: { name: "ApprovalCenter", scene: "crud", intent: crudIntent({ workflow: {} }) },
    },
    {
      name: "NotificationReport",
      expected: "L3",
      why: "未知场景",
      page: { name: "NotificationReport", scene: "report", intent: {} },
    },
    {
      name: "BrokenPage",
      expected: "L3",
      why: "缺声明必填 apiUrl",
      page: { name: "BrokenPage", scene: "crud", intent: { name: "BrokenPage", surfaces: { table: [field("a", "A")] } } },
    },
    {
      name: "EmptyPage",
      expected: "L3",
      why: "清单里既没有 parts 也没有 scene/intent",
      page: { name: "EmptyPage" },
    },
  ];

  it("人工标注的 12 页全部与分级结果一致", () => {
    const report = classifyCoverage({ pages: samples.map((s) => s.page) });
    const observed = report.pages.map((p) => p.level);
    const mismatches = samples
      .map((s, i) => (observed[i] === s.expected ? null : `${s.name}: 标注 ${s.expected}，实判 ${observed[i]}（${s.why}）`))
      .filter((m): m is string => m !== null);
    expect(mismatches).toEqual([]);
    expect(report.summary).toEqual({ L1: 4, L2: 3, L3: 5 });
  });

  it("传入 validatePart 时，形状不合法判 L3（不再误报为 L2）", () => {
    const report = classifyCoverage(
      { pages: [{ name: "Bad", scene: "crud", intent: { name: "Bad", apiUrl: "/x", surfaces: { table: "oops" } } }] },
      {
        validatePart: (scene, intent) =>
          scene === "crud" && !Array.isArray((intent as any)?.surfaces?.table)
            ? ["surfaces.table: Expected array, received string"]
            : [],
      },
    );
    expect(report.pages[0].level).toBe("L3");
    expect(report.pages[0].reasons.join("\n")).toContain("invalid intent shape");
    expect(report.pages[0].parts[0].ok).toBe(false);
  });

  it("元数据降级的无表页：part.degraded 保留，但等级是 L1", () => {
    const report = classifyCoverage({
      pages: [
        {
          name: "Search",
          scene: "crud",
          intent: { name: "Search", apiUrl: "/api/x", surfaces: { query: [field("a", "A")] } },
        },
      ],
    });
    expect(report.pages[0].level).toBe("L1");
    expect(report.pages[0].parts[0].degraded).toEqual(expect.arrayContaining(["name", "apiUrl"]));
    expect(report.pages[0].reasons).toEqual([]);
    expect(report.pages[0].parts[0].reasons.join("\n")).toContain("no host edit needed");
  });
});

describe("classifyCoverage — 清单形状与汇总", () => {
  it("多页汇总计数正确，且逐页独立判定", () => {
    const report = classifyCoverage({
      pages: [
        { name: "A", scene: "crud", intent: crudIntent() },
        {
          name: "B",
          scene: "crud",
          intent: crudIntent({ mode: "sfc", surfaces: { table: [field("x", "X")], dialog: ["add"] } }),
        },
        { name: "C", scene: "crud", intent: crudIntent({ nope: 1 }) },
      ],
    });
    expect(report.pages.map((p) => p.level)).toEqual(["L1", "L2", "L3"]);
    expect(report.summary).toEqual({ L1: 1, L2: 1, L3: 1 });
  });

  it("清单不是对象 / pages 不是数组 → inventoryErrors，不抛错", () => {
    expect(classifyCoverage(null).inventoryErrors.length).toBe(1);
    expect(classifyCoverage({ pages: "nope" }).inventoryErrors.length).toBe(1);
    expect(classifyCoverage({}).inventoryErrors[0]).toContain("pages");
  });

  it("pages 里出现非对象 → 该页 L3 且记录 inventoryErrors", () => {
    const report = classifyCoverage({ pages: ["nope"] });
    expect(report.pages[0].level).toBe("L3");
    expect(report.inventoryErrors[0]).toContain("pages[0]");
  });
});
