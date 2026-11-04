import { describe, it, expect } from "vitest";
import {
  CAPABILITY_CONTRACT_VERSION,
  CRUD_INTENT_KEYS,
  SCENE_INTENT_KEYS,
  TABLE_INTENT_KEYS,
  assessIntent,
  capabilityLedger,
} from "../src/scene/capability.js";
import { SCENE_REGISTRY } from "../src/scene/registry.js";
import { RENDER_PLAN_CONTRACT } from "../src/render-plan.js";
import { emitScene, emitSceneArtifact } from "../src/scene/emit.js";

/**
 * P9 —— 场景能力台账。
 *
 * 钉住四件事：
 *   ① 词汇来自场景接口（crud 19 键 / table 8 键），台账与 `SCENE_REGISTRY` 同源；
 *   ② CRUD 的降级判定直接读 `RENDER_PLAN_CONTRACT`（不另写文案）；
 *   ③ 无表格面时，片段分支没有载体的键被判 degraded（不再静默）；
 *   ④ 信封附带 capability，但文本与指纹口径不变。
 */

const field = { prop: "name", label: "姓名", formtype: "Input" };

function find(cap: ReturnType<typeof assessIntent>, key: string) {
  return cap.declared.find((d) => d.key === key);
}

describe("assessIntent —— 场景意图逐键判定", () => {
  it("crud + 表格 + schema：permissions 降级（schema 无动作→权限码通道）", () => {
    const cap = assessIntent({
      scene: "crud",
      intent: {
        name: "UserManage",
        apiUrl: "/api/users",
        surfaces: { table: [field] },
        permissions: { add: "user:add" },
      },
    });
    expect(cap.contract).toBe(CAPABILITY_CONTRACT_VERSION);
    expect(cap.mode).toBe("schema");
    expect(cap.target).toBe("vue3");
    expect(find(cap, "permissions")?.verdict).toBe("degraded");
    expect(find(cap, "permissions")?.reason).toContain("schema mode");
    expect(find(cap, "surfaces")?.verdict).toBe("accepted");
    expect(cap.ok).toBe(true);
    // 降级不阻断生成：语料仍可产出
    expect(cap.degraded).toEqual(["permissions"]);
  });

  it("crud + 表格 + sfc：dialogs / tableBtns 降级，permissions 保真", () => {
    const cap = assessIntent({
      scene: "crud",
      intent: {
        name: "UserManage",
        apiUrl: "/api/users",
        mode: "sfc",
        surfaces: { table: [field], dialog: ["add"] },
        permissions: { add: "user:add" },
        tableBtns: [{ name: "导出", actionType: "export" }],
      },
    });
    expect(cap.mode).toBe("sfc");
    expect(find(cap, "surfaces")?.verdict).toBe("degraded");
    expect(find(cap, "surfaces")?.reason).toContain("dialogs");
    expect(find(cap, "tableBtns")?.verdict).toBe("degraded");
    expect(find(cap, "permissions")?.verdict).toBe("accepted");
  });

  it("crud + sfc：operationColumn=false 保真（render-plan 的逐配置细化）", () => {
    const hidden = assessIntent({
      scene: "crud",
      intent: {
        name: "U",
        apiUrl: "/api/u",
        mode: "sfc",
        surfaces: { table: [field] },
        operationColumn: false,
      },
    });
    expect(find(hidden, "operationColumn")?.verdict).toBe("accepted");

    const custom = assessIntent({
      scene: "crud",
      intent: {
        name: "U",
        apiUrl: "/api/u",
        mode: "sfc",
        surfaces: { table: [field] },
        operationColumn: { width: 220 },
      },
    });
    expect(find(custom, "operationColumn")?.verdict).toBe("degraded");
  });

  it("crud 无表格面：整页生成器不参与，未进片段的键判 degraded", () => {
    const cap = assessIntent({
      scene: "crud",
      intent: {
        name: "Search",
        apiUrl: "/api/search",
        mode: "schema",
        surfaces: { query: [field] },
        formLayout: { labelWidth: 90 },
        tableOptions: { border: true },
        pagination: { pageSize: 20 },
        unknownKey: 1,
      },
    });
    expect(find(cap, "formLayout")?.verdict).toBe("accepted");
    expect(find(cap, "tableOptions")?.verdict).toBe("degraded");
    expect(find(cap, "pagination")?.verdict).toBe("degraded");
    expect(find(cap, "name")?.verdict).toBe("degraded");
    expect(find(cap, "mode")?.verdict).toBe("degraded");
    expect(find(cap, "mode")?.reason).toContain("fragments are always emitted as sfc");
    expect(find(cap, "unknownKey")?.verdict).toBe("unsupported");
    expect(cap.ok).toBe(false);
    expect(cap.unsupported).toEqual(["unknownKey"]);
  });

  it("片段场景：认不出的键判 unsupported 并列出合法词汇（直接消费者不再静默）", () => {
    const cap = assessIntent({
      scene: "table",
      intent: { fields: [field], columns: [{ prop: "x", label: "X" }] },
    });
    expect(find(cap, "fields")?.verdict).toBe("accepted");
    expect(find(cap, "columns")?.verdict).toBe("unsupported");
    expect(find(cap, "columns")?.reason).toContain("accepted keys");
    expect(find(cap, "columns")?.reason).toContain(TABLE_INTENT_KEYS.join(", "));
    expect(cap.ok).toBe(false);
  });

  it("必需键缺失进 missing（crud 的 name/apiUrl/surfaces）", () => {
    const cap = assessIntent({ scene: "crud", intent: { surfaces: { table: [field] } } });
    expect(cap.missing).toEqual(["name", "apiUrl"]);
    expect(cap.ok).toBe(false);
  });

  it("dialog：mode 轴为 composable / component", () => {
    const comp = assessIntent({ scene: "dialog", intent: { fields: [field], mode: "component" } });
    expect(comp.mode).toBe("component");
    expect(find(comp, "mode")?.verdict).toBe("accepted");
    const dflt = assessIntent({ scene: "dialog", intent: { fields: [field] } });
    expect(dflt.mode).toBe("composable");
  });
});

describe("capabilityLedger —— 台账与源码同源", () => {
  const ledger = capabilityLedger();

  it("四场景与 SCENE_REGISTRY 一致", () => {
    expect(ledger.scenes.map((s) => s.scene)).toEqual(SCENE_REGISTRY.map((s) => s.id));
    for (const s of ledger.scenes) {
      const contract = SCENE_REGISTRY.find((c) => c.id === s.scene)!;
      expect(s.required).toEqual(contract.intent.required);
      expect(s.accepted).toEqual([...SCENE_INTENT_KEYS[s.scene]]);
    }
  });

  it("crudKeys 是 RENDER_PLAN_CONTRACT 的直接投影", () => {
    expect(ledger.crudKeys.map((k) => k.key)).toEqual(Object.keys(RENDER_PLAN_CONTRACT));
    for (const row of ledger.crudKeys) {
      const rule = RENDER_PLAN_CONTRACT[row.key as keyof typeof RENDER_PLAN_CONTRACT];
      expect(row.schema).toBe(rule.schema);
      expect(row.sfc).toBe(rule.sfc);
      expect(row.reason).toBe((rule as { reason?: string }).reason);
    }
  });

  it("无表分支：accepted / degraded 互斥且并集 == CRUD 词汇", () => {
    const { accepted, degraded } = ledger.crudWithoutTable;
    expect(accepted.filter((k) => degraded.includes(k))).toEqual([]);
    expect([...accepted, ...degraded].sort()).toEqual([...CRUD_INTENT_KEYS].sort());
  });
});

describe("信封 —— capability 是派生视图，不改变文本", () => {
  const plan = {
    scene: "table" as const,
    intent: { apiUrl: "/api/logs", fields: [field], target: "vue3" as const },
  };

  it("emitSceneArtifact 挂 capability，文本与 emitScene 逐字节相同", () => {
    const withEnvelope = emitSceneArtifact(plan);
    const plain = emitScene(plan);
    expect(withEnvelope.text).toBe(plain.text);
    expect(withEnvelope.envelope?.capability?.contract).toBe(CAPABILITY_CONTRACT_VERSION);
    expect(withEnvelope.envelope?.capability?.scene).toBe("table");
    // 指纹只覆盖 content：附加 capability 后不变（同一份产物的身份不变）
    const again = emitSceneArtifact(plan);
    expect(again.envelope?.fingerprint).toBe(withEnvelope.envelope?.fingerprint);
    expect(JSON.parse(JSON.stringify(withEnvelope.envelope))).toEqual(withEnvelope.envelope);
  });
});
