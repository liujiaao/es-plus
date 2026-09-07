<template>
  <div>
    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 10px;"
      description="批量导入：粘贴多行「姓名,部门,薪资」→ 解析预览 → 提交假后端逐行校验 → 回填每行结果（成功/失败原因），合法行落库。"
    />
    <el-input
      v-model="rawText"
      type="textarea"
      :rows="5"
      placeholder="每行一条，用逗号分隔：姓名,部门,薪资&#10;例如：张三,技术部,12000"
      style="margin-bottom: 10px;"
    />
    <div style="margin-bottom: 10px; display: flex; gap: 8px; align-items: center;">
      <el-button size="mini" type="primary" @click="parse">解析</el-button>
      <el-button size="mini" type="success" :loading="importing" :disabled="!parsedRows.length" @click="doImport">
        导入（{{ parsedRows.length }} 行）
      </el-button>
      <el-button size="mini" @click="reset">清空</el-button>
      <span v-if="result" style="font-size: 13px;">
        成功 <strong style="color:#67c23a">{{ result.created }}</strong> ·
        失败 <strong style="color:#f56c6c">{{ result.failed }}</strong>
      </span>
    </div>
    <es-table
      v-if="parsedRows.length"
      :data-source="parsedRows"
      :columns="columns"
      :options="options"
    />
  </div>
</template>

<script lang="jsx">
/**
 * 批量导入 —— 补齐「批量写 + 逐行结果反馈」场景
 *
 * 关键点：
 *   1. 纯前端解析粘贴文本为结构化行（容错空行/列缺失）。
 *   2. api.bulkCreate 返回 { created, failed, errors:[{row,message}] }，
 *      按行号把错误回填到预览表的状态列。
 *   3. 合法行落库、非法行标红并给出原因，导入结果一目了然。
 */
import { defineComponent, ref } from '@vue/composition-api'
import { Message } from 'element-ui'
import { createEmployeeService } from '../_mock/crud-service'

export default defineComponent({
  name: 'CombinationImportData',
  setup() {
    const api = createEmployeeService({ seedCount: 20 })
    const rawText = ref('张三,技术部,12000\n李四,产品部,9500\n员工1,技术部,8000\n,市场部,7000\n王五,设计部,-100')
    const parsedRows = ref([])
    const importing = ref(false)
    const result = ref(null)

    const parse = () => {
      const lines = rawText.value.split('\n').map((l) => l.trim()).filter(Boolean)
      if (!lines.length) {
        Message.warning('没有可解析的内容')
        return
      }
      parsedRows.value = lines.map((line, i) => {
        const [name = '', department = '', salary = ''] = line.split(/[,\t，]/).map((s) => s.trim())
        return { _line: i + 1, name, department, salary: salary === '' ? null : Number(salary), _status: 'pending', _message: '' }
      })
      result.value = null
    }

    const doImport = async () => {
      importing.value = true
      try {
        const rows = parsedRows.value.map((r) => ({ name: r.name, department: r.department, salary: r.salary }))
        const res = await api.bulkCreate(rows)
        result.value = res
        const errMap = new Map(res.errors.map((e) => [e.row, e.message]))
        parsedRows.value = parsedRows.value.map((r) => {
          const msg = errMap.get(r._line)
          return msg
            ? { ...r, _status: 'error', _message: msg }
            : { ...r, _status: 'ok', _message: '导入成功' }
        })
        Message[res.failed ? 'warning' : 'success'](`导入完成：成功 ${res.created}，失败 ${res.failed}`)
      } catch (e) {
        Message.error(e.message)
      } finally {
        importing.value = false
      }
    }

    const reset = () => {
      rawText.value = ''
      parsedRows.value = []
      result.value = null
    }

    const columns = [
      { prop: '_line', label: '行号', width: 70 },
      { prop: 'name', label: '姓名', minWidth: 110 },
      { prop: 'department', label: '部门', width: 120 },
      {
        prop: 'salary', label: '薪资', width: 120, align: 'right',
        formatter: (row) => (row.salary == null ? '—' : Number(row.salary).toLocaleString())
      },
      {
        prop: '_status', label: '结果', minWidth: 160,
        render: (h, { row }) => {
          if (row._status === 'pending') return <el-tag size="small" type="info" effect="plain">待导入</el-tag>
          const type = row._status === 'ok' ? 'success' : 'danger'
          return <el-tag size="small" type={type}>{row._message}</el-tag>
        }
      }
    ]

    const options = { border: true, rowkey: '_line', size: 'small', maxHeight: 320 }

    return { rawText, parsedRows, importing, result, parse, doImport, reset, columns, options }
  }
})
</script>
