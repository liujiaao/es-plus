# 3-client manual test checklist — @es-plus/mcp-server 1.2.0

This is the human-only verification step before promoting the
`@beta` tag to `@latest` on npm. Resource URI templating
(`esplus://conventions/vue2` etc.) and the `instructions` field on
initialize have never been field-tested across multiple MCP clients —
this checklist exercises both.

Goal: prove that **every supported MCP client** correctly:

1. Calls `detect_project_target` before generating
2. Honors the returned target
3. Fetches the `/vue2` resource variants when target=vue2
4. Surfaces the server `instructions` to the AI (or at least uses them)

Time budget: ~20 minutes per client × 3 clients = ~1 hour total.

---

## Setup (once)

Build + link the local mcp-server:

```bash
cd packages/mcp-server
npm run build
npm link
```

Have two test projects ready:

```
/tmp/test-vue3/   ← Vite + Vue 3 + Element Plus + @es-plus/vue3 (any starter)
/tmp/test-vue2/   ← Vue 2.7 + Element UI + @es-plus/vue2 (any starter)
```

Both should have a non-trivial `package.json` so `detect_project_target` has
something to detect.

---

## Client 1: Claude Code

### Config

Add to `~/.claude/settings.json` (or the project-local equivalent):

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "mcp-server-es-plus"
    }
  }
}
```

### Scenarios

In `/tmp/test-vue3/`, open Claude Code and prompt:

> 在我项目里加个用户管理 CRUD 页面，查询条件姓名/手机/状态，列表显示姓名/手机/邮箱/状态/创建时间，支持新增编辑删除。

**Expected trace** (visible in Claude Code's tool-call log):

- [ ] AI reads `package.json` first
- [ ] AI calls `detect_project_target` with the package.json content
- [ ] Returned target is `vue3` with `confidence: 'high'`
- [ ] AI calls `generate_crud_schema` or `generate_crud_page` with `target: 'vue3'`
- [ ] (Optional) AI reads `esplus://conventions` (defaults to vue3)
- [ ] Generated SFC uses `<script setup>` + `@es-plus/vue3` + `v-model:*`

Repeat in `/tmp/test-vue2/` with the same prompt:

- [ ] AI calls `detect_project_target` → returns `vue2`
- [ ] AI calls generator with `target: 'vue2'`
- [ ] AI fetches `esplus://conventions/vue2` (NOT the bare default)
- [ ] Generated SFC uses `defineComponent + setup()` + `@es-plus/vue2` +
      `:*.sync` + `element-ui` imports (not element-plus)

### Edge cases

- [ ] Server `instructions` are visible to Claude (check trace for
      "always detect first" guidance being honored)
- [ ] When user explicitly asks "在我的 vue3 项目里" while in /tmp/test-vue2/,
      Claude correctly questions the conflict or generates vue3 anyway
      (acceptable either way, but should not silently emit vue2)

---

## Client 2: Cursor

### Config

Project-local `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "es-plus": {
      "command": "mcp-server-es-plus"
    }
  }
}
```

### Scenarios

Same two prompts as Claude Code.

- [ ] Cursor calls tools in the same order Claude did
- [ ] Cursor renders the `instructions` field (check the MCP server status
      panel — if Cursor exposes it)
- [ ] vue2 vs vue3 outputs are visually distinct in the generated code
- [ ] If Cursor caches resource fetches, retest after a fresh session — the
      `/vue2` variant must NOT serve the vue3 default by mistake

### Known gotchas to verify

- [ ] Cursor's MCP cache invalidates correctly on server restart
- [ ] No "tool not found" errors for `detect_project_target` (Cursor versions
      < 0.42 had issues with tools added mid-session)

---

## Client 3: Continue

### Config

`~/.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "es-plus",
      "command": "mcp-server-es-plus"
    }
  ]
}
```

### Scenarios

Same two prompts.

- [ ] Continue's resource browser lists all 12 URIs (3 variants × 4 base names)
- [ ] Tool list shows 9 tools including `detect_project_target` first
- [ ] Generated code for vue2 is syntactically correct (run
      `vite build` in `/tmp/test-vue2/` to confirm)

---

## Compatibility matrix to record after testing

Fill this in and add to the mcp-server README before `@latest` promotion:

| Client        | Version tested | Tool calls correct? | Resource URIs correct? | Instructions surfaced? | Notes |
|---------------|----------------|--------------------|-----------------------|------------------------|-------|
| Claude Code   |                |                    |                       |                        |       |
| Cursor        |                |                    |                       |                        |       |
| Continue      |                |                    |                       |                        |       |

---

## After all clients pass

```bash
cd packages/mcp-server && npm publish --tag latest
cd packages/cli && npm publish --tag latest
cd packages/shared && npm publish --tag latest
cd packages/vue2 && npm publish --tag latest
```

(Order matters: shared first because cli + mcp-server depend on it.)

If any client fails:

- [ ] File an issue with the trace
- [ ] Keep packages on `@beta` until the bug is fixed
- [ ] Re-run this checklist after the fix
