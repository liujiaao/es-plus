/**
 * 「异构后端接管」案例的 mock 后端 —— 三站共用同一份字节。
 *
 * 演示簇 C9：后端不是本库默认口径时，**用配置适配**而不是改后端、也不写函数：
 *   · 列表信封是 `{ list, totalCount }`（本库默认是 `{ rows, records }`）
 *     → `tableOptions.configTableOut: { tableData: 'list', total: 'totalCount' }`；
 *   · 供应商下拉的选项来自另一个接口 → 字段级 `apiParams: { url, labelField, valueField }`，
 *     渲染器据此自己去取并映射成 label/value（配置里没有任何请求代码）。
 *
 * 一个 httpRequest 同时服务「列表」与「选项」两个接口，靠 `params.url` 分流 ——
 * 这正是宿主该做的事：后端长什么样是宿主的知识，配置只声明**怎么读**。
 *
 * 契约见 `employee-roster.mock.js` 文件头。
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const SUPPLIERS = [
  { id: 1, name: '华东供应链', contact: '021-8800-1001' },
  { id: 2, name: '鹏程电子', contact: '0755-6600-2002' },
  { id: 3, name: '恒信五金', contact: '0571-5500-3003' },
  { id: 4, name: '远航包装', contact: '028-4400-4004' },
]

const GOODS = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  sku: `ERP-${String(5001 + i)}`,
  name: `配件-${String.fromCharCode(65 + (i % 26))}${i + 1}`,
  supplierId: SUPPLIERS[i % SUPPLIERS.length].id,
  // 老 ERP 的列表接口把名称一起冗余返回 —— 表格直接显示它，不必在前端做一次 id→name
  supplierName: SUPPLIERS[i % SUPPLIERS.length].name,
  price: ((199 + i * 137) % 4000) + 9.9,
  stock: (i * 37) % 500,
}))

let nextId = 500

export function createPermission() {
  return () => true
}

export function createHttpRequest({ delay = 120 } = {}) {
  return async (params = {}) => {
    if (delay) await sleep(delay)
    const url = String(params.url || '')
    // ① 选项接口：core 会剥一层 `data`，所以这里返回 { data: [...] }
    if (url.includes('/api/suppliers')) {
      return { data: SUPPLIERS.map((item) => ({ ...item })), total: SUPPLIERS.length }
    }
    // ② 列表接口：老 ERP 的信封（list / totalCount），由 case 的 configTableOut 读
    const { formParams = {} } = params
    const pageNo = params.pageNo || params.pageIndex || 1
    const pageSize = params.pageSize || 10
    const sku = String(formParams.sku || '').trim()
    const name = String(formParams.name || '').trim()
    const supplierId = formParams.supplierId
    const rows = GOODS.filter((row) => {
      if (sku && !row.sku.includes(sku)) return false
      if (name && !row.name.includes(name)) return false
      if (supplierId !== undefined && supplierId !== '' && supplierId !== null && Number(row.supplierId) !== Number(supplierId)) return false
      return true
    })
    const start = (pageNo - 1) * pageSize
    return { list: rows.slice(start, start + pageSize).map((row) => ({ ...row })), totalCount: rows.length }
  }
}

export function handleDialogConfirm(key, data = {}, row) {
  if (key === 'add') {
    const record = {
      id: nextId++,
      sku: data.sku,
      name: data.name,
      supplierId: data.supplierId === undefined || data.supplierId === null ? SUPPLIERS[0].id : Number(data.supplierId),
      price: Number(data.price) || 0,
      stock: Number(data.stock) || 0,
    }
    GOODS.unshift(record)
    return `已新增：${record.name}（${record.sku}）`
  }
  if (key === 'edit') {
    const target = GOODS.find((item) => item.id === Number(row?.id ?? data.id))
    if (!target) return null
    Object.assign(target, {
      sku: data.sku ?? target.sku,
      name: data.name ?? target.name,
      supplierId: data.supplierId === undefined || data.supplierId === null ? target.supplierId : Number(data.supplierId),
      price: data.price === undefined || data.price === null ? target.price : Number(data.price),
      stock: data.stock === undefined || data.stock === null ? target.stock : Number(data.stock),
    })
    return `已保存：${target.name}`
  }
  return null
}

export function handleRowAction() {
  return null
}

/** 调试/测试用快照。 */
export function listGoods() {
  return GOODS.map((row) => ({ ...row }))
}

export function listSuppliers() {
  return SUPPLIERS.map((row) => ({ ...row }))
}
