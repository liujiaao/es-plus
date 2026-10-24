<template>
  <div class="import-wizard">
    <p class="wizard-hint">
      粘贴 CSV → 前端校验（必填 / 枚举 / 数字 / 重复）→ 错误行就地修正 → 每 3 条一批提交。
      服务端只裁决业务规则（薪资超过 ¥20,000 需审批），被拒行修正后再提交，
      <strong>只补交待导入 / 失败行，已成功的行不会重提</strong>。导入结果由
      <code>entryQuery</code> 带入批次号重新查询，整批可回滚。
    </p>

    <div class="wizard-actions">
      <el-button type="primary" size="small" @click="openWizard">导入员工数据</el-button>
      <span v-if="lastBatchId" class="batch-meta">
        批次 <code>{{ lastBatchId }}</code> · {{ batchRowCount() }} 条
      </span>
    </div>

    <template v-if="lastBatchId">
      <div class="batch-bar">
        <span>结果表由 <code>entryQuery: { batchId }</code> 触发重新请求，不是本地赋值</span>
        <el-button type="text" size="mini" class="danger-text" @click="rollbackBatch">回滚该批次</el-button>
      </div>
      <es-table ref="resultRef" :columns="resultColumns" :options="resultOptions" />
    </template>
  </div>
</template>

<script lang="jsx">
/**
 * 可回滚的批量导入（组合）—— EsForm + EsTable + useDialog 的完整数据链路
 *
 * 1. CSV 在前端解析并校验：必填 / 部门枚举 / 数字 / 文件内重复 / 系统已存在；
 * 2. 错误行用 EsForm（带 rules）就地修正，修正后整表重新校验（重复规则依赖其它行）；
 * 3. 提交按 3 条一批，服务端只裁决业务规则（审批阈值），被拒行标注原因；
 * 4. 再次提交只挑「待导入 / 失败」行 —— 已成功的行不会重提，天然幂等；
 * 5. 结果表不绑定本地数组，而是 `entryQuery: { batchId }` + httpRequest 重新查询，
 *    回滚时后端整批删除，同一批次号重查即为空。
 */
import { defineComponent, ref, reactive, computed, nextTick, getCurrentInstance } from '@vue/composition-api'
import { Message } from 'element-ui'
import { useDialog } from '@es-plus/vue2'

const DEPARTMENTS = ['技术部', '产品部', '市场部', '财务部']
const DEPT_OPTIONS = DEPARTMENTS.map((d) => ({ label: d, value: d }))
// 「HR 系统里已存在的员工」：前端查重是导入的第一道闸
const ROSTER = new Set(['孙七', '钱一'])
const APPROVAL_LIMIT = 20000
const CHUNK_SIZE = 3
const SAMPLE_CSV = [
  '姓名,部门,薪资',
  '张三,技术部,12000',
  '李四,销售部,9000',
  '王五,产品部,',
  '张三,技术部,12000',
  '赵六,财务部,abc',
  '孙七,市场部,15000',
  '周八,产品部,22000',
  '吴九,技术部,9800'
].join('\n')

export default defineComponent({
  name: 'CombinationImportWizard',
  setup() {
    // ── 假后端：按批次整批存取，回滚 = 整批删除 ──
    // 包一层对象而不是直接用 reactive([])：Vue 2 里数组自身的 splice 只会通知 childOb，
    // 只有「访问对象属性」时渲染 watcher 才会收集到这条依赖，直接闭包引用数组不会重渲染。
    const store = reactive({ batches: [] })
    const lastBatchId = ref('')
    // Vue 2 的字符串 ref 只落到 $refs，不会回填 setup 里的 ref，故走实例代理取表格方法
    const { proxy } = getCurrentInstance()
    const reloadResult = () => {
      const table = proxy && proxy.$refs && proxy.$refs.resultRef
      table && table.reload()
    }
    let batchSeq = 0

    const findBatch = (id) => store.batches.find((batch) => batch.id === id)
    // 写成函数而非 computed：模板里直接调用，渲染 watcher 会亲自收集批次列表的依赖。
    const batchRowCount = () => {
      const batch = lastBatchId.value ? findBatch(lastBatchId.value) : null
      return batch ? batch.rows.length : 0
    }

    // entryQuery 在「请求发出时」取值，所以 formParams 里一定有当前批次号
    const fetchBatchRows = (payload) =>
      new Promise((resolve) => {
        const batchId = payload && payload.formParams && payload.formParams.batchId
        setTimeout(() => {
          const rows = (findBatch(batchId) || { rows: [] }).rows
          resolve({ code: 0, result: { rows, total: rows.length } })
        }, 260)
      })

    const resultColumns = [
      { prop: 'lineNo', label: '行', width: 56, align: 'center' },
      { prop: 'name', label: '姓名', minWidth: 100 },
      { prop: 'dept', label: '部门', width: 100 },
      { prop: 'salary', label: '薪资', width: 110, align: 'right', formatter: (row) => `¥${Number(row.salary).toLocaleString()}` },
      { prop: 'batchId', label: '批次', minWidth: 150 }
    ]

    const resultOptions = computed(() => ({
      border: true,
      size: 'small',
      rowkey: 'lineNo',
      heightType: 'height',
      tabHeight: 200,
      httpRequest: fetchBatchRows,
      apiParams: { url: '/api/import/rows', model: {} },
      entryQuery: { batchId: lastBatchId.value },
      configTableOut: { tableData: 'rows', total: 'total' }
    }))

    const rollbackBatch = () => {
      const index = store.batches.findIndex((batch) => batch.id === lastBatchId.value)
      if (index === -1) return
      store.batches.splice(index, 1)
      reloadResult()
      Message.success(`已回滚批次 ${lastBatchId.value}：后端整批删除，按同一批次号重查为空`)
    }

    const dialog = useDialog()

    const openWizard = () => {
      const step = ref(0)
      const csvText = ref(SAMPLE_CSV)
      const rows = reactive([])
      const logs = reactive([])
      const fixingId = ref(null)
      const fixModel = reactive({ name: '', dept: '', salary: null })
      const submitting = ref(false)
      const batchId = ref('')
      let fixFormRef = null

      const validateRow = (row) => {
        const errors = []
        if (!row.name) errors.push('姓名必填')
        else if (ROSTER.has(row.name)) errors.push(`系统中已存在「${row.name}」`)
        if (!DEPARTMENTS.includes(row.dept)) errors.push(`部门必须是 ${DEPARTMENTS.join(' / ')}`)
        if (row.salary === null || row.salary === undefined || Number.isNaN(Number(row.salary))) {
          errors.push('薪资必填且必须是数字')
        } else if (Number(row.salary) <= 0) {
          errors.push('薪资必须大于 0')
        }
        const dup = rows.find(
          (other) => other.id < row.id && other.name === row.name && other.dept === row.dept && other.salary === row.salary
        )
        if (row.name && dup) errors.push(`与第 ${dup.id} 行重复`)
        return errors
      }

      const validateAll = () => {
        rows.forEach((row) => {
          if (row.status === 'imported') return
          row.errors = validateRow(row)
          if (row.errors.length) row.status = 'invalid'
          else if (row.status !== 'failed') row.status = 'ready'
        })
      }

      const invalidCount = computed(() => rows.filter((row) => row.status === 'invalid').length)
      const importedCount = computed(() => rows.filter((row) => row.status === 'imported').length)
      const readyCount = computed(() => rows.filter((row) => row.status === 'ready').length)
      const pendingRows = computed(() => rows.filter((row) => row.status === 'ready' || row.status === 'failed'))
      // 注意：写成函数而不是 computed —— Vue 2 + composition-api 下「computed 依赖 computed」
      // 在本例的调用时机里不会随行状态变更重新求值，导致「完成」按钮一直禁用。
      const isAllDone = () => rows.length > 0 && pendingRows.value.length === 0 && invalidCount.value === 0

      const parseCsv = () => {
        const lines = csvText.value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
        if (lines.length && /^(姓名|name)/i.test(lines[0])) lines.shift()
        const parsed = lines.map((line, index) => {
          const [name = '', dept = '', salary = ''] = line.split(/[,\t，]/).map((cell) => cell.trim())
          return {
            id: index + 1,
            lineNo: index + 1,
            name,
            dept,
            salary: salary === '' ? null : Number(salary),
            errors: [],
            status: 'ready',
            serverMsg: ''
          }
        })
        if (!parsed.length) {
          Message.warning('没有解析到数据行')
          return
        }
        rows.splice(0, rows.length, ...parsed)
        logs.splice(0, logs.length)
        step.value = 1
        validateAll()
      }

      const startFix = (row) => {
        fixingId.value = row.id
        fixModel.name = row.name
        fixModel.dept = row.dept
        fixModel.salary = Number.isNaN(Number(row.salary)) ? null : row.salary
      }

      const cancelFix = () => {
        fixingId.value = null
      }

      const applyFix = async () => {
        let result = true
        try {
          result = await (fixFormRef && fixFormRef.validate())
        } catch (error) {
          result = false
        }
        if (result === false) return
        const target = rows.find((row) => row.id === fixingId.value)
        if (!target) return
        target.name = String(fixModel.name || '').trim()
        target.dept = fixModel.dept
        target.salary = fixModel.salary === null || fixModel.salary === '' ? null : Number(fixModel.salary)
        target.serverMsg = ''
        target.status = 'ready'
        validateAll()
        if (target.status === 'invalid') {
          Message.error(`仍未通过校验：${target.errors[0]}`)
          return
        }
        fixingId.value = null
      }

      // 服务端：只裁决业务规则，不重复前端格式校验
      const serverDecision = (chunk) =>
        new Promise((resolve) => {
          setTimeout(() => {
            const accepted = []
            const rejected = []
            chunk.forEach((row) => {
              if (Number(row.salary) > APPROVAL_LIMIT) {
                rejected.push({
                  id: row.id,
                  message: `薪资 ¥${Number(row.salary).toLocaleString()} 超过审批阈值 ¥${APPROVAL_LIMIT.toLocaleString()}`
                })
              } else {
                accepted.push(row)
              }
            })
            resolve({ accepted, rejected })
          }, 240)
        })

      const ensureBatch = () => {
        if (!batchId.value) {
          batchSeq += 1
          const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
          batchId.value = `IMP-${stamp}-${String(batchSeq).padStart(3, '0')}`
          store.batches.push({ id: batchId.value, rows: [] })
        }
        return findBatch(batchId.value)
      }

      const publishBatch = async () => {
        // 批次号可能已在首次成功后发布；这里仍要 reload，补交待导入行后表格才看得到最新结果
        lastBatchId.value = batchId.value
        await nextTick()
        reloadResult()
      }

      const submitPending = async () => {
        const pending = rows.filter((row) => row.status === 'ready' || row.status === 'failed')
        if (!pending.length) return
        submitting.value = true
        const batch = ensureBatch()
        logs.push(`批次 ${batch.id} 开始提交：${pending.length} 条，每批 ${CHUNK_SIZE} 条`)
        let rejectedTotal = 0
        try {
          const chunks = []
          for (let i = 0; i < pending.length; i += CHUNK_SIZE) chunks.push(pending.slice(i, i + CHUNK_SIZE))
          for (let i = 0; i < chunks.length; i += 1) {
            const { accepted, rejected } = await serverDecision(chunks[i])
            accepted.forEach((row) => {
              row.status = 'imported'
              row.serverMsg = ''
              batch.rows.push({ ...row, batchId: batch.id })
            })
            rejected.forEach(({ id, message: reason }) => {
              const target = rows.find((row) => row.id === id)
              if (!target) return
              target.status = 'failed'
              target.serverMsg = reason
            })
            rejectedTotal += rejected.length
            const names = rejected.map(({ id }) => (rows.find((row) => row.id === id) || {}).name).filter(Boolean)
            logs.push(
              `第 ${i + 1}/${chunks.length} 批：成功 ${accepted.length} 条${rejected.length ? ` · 被拒 ${rejected.length} 条（${names.join('、')}）` : ''}`
            )
            await new Promise((resolve) => setTimeout(resolve, 0))
          }
          await publishBatch()
          if (rejectedTotal) Message.warning(`本轮被拒 ${rejectedTotal} 条，修正后可再次提交`)
          else Message.success(`已导入 ${batch.rows.length} 条，点「完成」回到页面查看批次`)
        } finally {
          submitting.value = false
        }
      }

      const statusMeta = {
        invalid: ['待修正', 'danger'],
        ready: ['待导入', 'warning'],
        imported: ['已导入', 'success'],
        failed: ['被拒', 'danger']
      }

      const previewColumns = [
        { prop: 'lineNo', label: '行', width: 52, align: 'center' },
        { prop: 'name', label: '姓名', width: 90 },
        { prop: 'dept', label: '部门', width: 90 },
        {
          prop: 'salary',
          label: '薪资',
          width: 100,
          align: 'right',
          formatter: (row) =>
            row.salary === null || Number.isNaN(Number(row.salary)) ? '—' : `¥${Number(row.salary).toLocaleString()}`
        },
        {
          prop: 'status',
          label: '状态',
          width: 88,
          render: (h, { row }) => {
            const [text, type] = statusMeta[row.status] || ['—', 'info']
            return <el-tag size="small" type={type}>{text}</el-tag>
          }
        },
        {
          prop: 'problem',
          label: '问题',
          minWidth: 170,
          render: (h, { row }) => {
            const text = row.errors[0] || row.serverMsg
            return text ? <span style="color: #f56c6c">{text}</span> : <span style="color: #c0c4cc">—</span>
          }
        },
        {
          prop: 'operate',
          label: '操作',
          width: 76,
          btns: [
            {
              name: '修正',
              type: 'primary',
              hidden: (row) => row.status !== 'invalid' && row.status !== 'failed',
              clickEvent: startFix
            }
          ]
        }
      ]

      const previewOptions = { border: true, size: 'small', rowkey: 'id', heightType: 'height', tabHeight: 260 }

      const fixFormItems = [
        {
          prop: 'name',
          label: '姓名',
          formtype: 'Input',
          span: 8,
          formItemOptions: { rules: [{ required: true, message: '请输入姓名' }] }
        },
        {
          prop: 'dept',
          label: '部门',
          formtype: 'Select',
          span: 8,
          dataOptions: DEPT_OPTIONS,
          formItemOptions: { rules: [{ required: true, message: '请选择部门' }] }
        },
        {
          prop: 'salary',
          label: '薪资',
          formtype: 'InputNumber',
          span: 8,
          attrs: { min: 1, style: 'width: 100%' },
          formItemOptions: { rules: [{ required: true, message: '请输入薪资' }] }
        }
      ]

      dialog({
        title: '批量导入向导',
        width: '860px',
        render: (h) => {
          // 注意：这里不用 v-model —— @vue/babel-sugar-composition-api-render-instance
          // 在「setup() 简写 + JSX v-model」组合下会抛 TypeError（读 undefined.body），
          // 故 CSV 文本框显式写 value + on-input。
          const stepsEl = (
            <el-steps active={step.value} simple finishStatus="success" style="margin-bottom: 16px">
              <el-step title="读取 CSV" />
              <el-step title="校验并导入" />
            </el-steps>
          )

          if (step.value === 0) {
            return (
              <div>
                {stepsEl}
                <el-input
                  value={csvText.value}
                  on-input={(v) => (csvText.value = v)}
                  type="textarea"
                  rows={8}
                  placeholder="每行一条：姓名,部门,薪资"
                />
                <p class="csv-tip">
                  第一行表头可省略；分隔符支持 <code>,</code> / <code>，</code> / Tab。示例里刻意混入了
                  部门不存在、薪资缺失、非数字、重复行和系统中已存在的员工。
                </p>
              </div>
            )
          }

          return (
            <div>
              {stepsEl}
              <div class="wizard-summary">
                共 {rows.length} 行 · 可导入 {readyCount.value} · 待修正 {invalidCount.value} · 已导入 {importedCount.value}
              </div>
              <es-table data-source={rows} columns={previewColumns} options={previewOptions} />
              {fixingId.value !== null && (
                <div class="fix-panel">
                  <div class="fix-title">修正第 {fixingId.value} 行</div>
                  <es-form
                    ref={(el) => {
                      if (el) fixFormRef = el
                    }}
                    model={fixModel}
                    form-item-list={fixFormItems}
                    layout-form-props={{ formLayProps: { labelWidth: '56px', size: 'small' } }}
                  />
                  <div class="fix-actions">
                    <el-button size="mini" onClick={cancelFix}>
                      取消
                    </el-button>
                    <el-button size="mini" type="primary" onClick={applyFix}>
                      保存修正
                    </el-button>
                  </div>
                </div>
              )}
              {logs.length > 0 && (
                <ul class="import-log">
                  {logs.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        },
        configBtn: [
          { name: '关闭', click: (_, { close }) => close() },
          {
            name: '上一步',
            disabled: () => step.value === 0 || submitting.value || importedCount.value > 0,
            click: () => {
              step.value = 0
            }
          },
          {
            name: '解析并校验',
            type: 'primary',
            disabled: () => step.value === 1 || submitting.value,
            click: parseCsv
          },
          {
            name: '提交',
            type: 'success',
            disabled: () => step.value === 0 || submitting.value || invalidCount.value > 0 || pendingRows.value.length === 0,
            click: submitPending
          },
          {
            name: '完成',
            type: 'primary',
            disabled: () => !isAllDone() || submitting.value,
            click: async (_, { close }) => {
              await publishBatch()
              close()
            }
          }
        ]
      })
    }

    return {
      lastBatchId,
      batchRowCount,
      resultColumns,
      resultOptions,
      rollbackBatch,
      openWizard
    }
  }
})
</script>

<style>
/* 弹窗内容由 useDialog 挂到 body，类名统一前缀、样式全局化 */
.import-wizard {
  padding: 0;
}

.import-wizard .wizard-hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.8;
  color: #606266;
}

.import-wizard .wizard-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.import-wizard .batch-meta {
  font-size: 13px;
  color: #909399;
}

.import-wizard .batch-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 14px 0 8px;
  font-size: 12px;
  color: #909399;
}

.import-wizard .danger-text {
  color: #f56c6c;
}

.import-wizard code,
.el-dialog .csv-tip code {
  background: #f5f5f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  color: #d63384;
}

.el-dialog .csv-tip {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
}

.el-dialog .wizard-summary {
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}

.el-dialog .fix-panel {
  margin-top: 12px;
  padding: 12px 12px 4px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fafafa;
}

.el-dialog .fix-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.el-dialog .fix-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-bottom: 8px;
}

.el-dialog .import-log {
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.9;
  color: #606266;
}
</style>
