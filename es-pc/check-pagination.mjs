/**
 * Puppeteer 验证分页器是否覆盖在表格上 + 是否在容器内可见
 */
import puppeteer from 'file:///D:/nodejs/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })

await page.goto('http://localhost:13966/#/es-table', { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise(r => setTimeout(r, 3000))

const results = {}

for (const height of ['300px', '500px', '100%']) {
  const clicked = await page.evaluate((h) => {
    const labels = document.querySelectorAll('.ant-radio-button-wrapper')
    for (const label of labels) {
      if (label.textContent.trim() === h) {
        label.click()
        return true
      }
    }
    return false
  }, height)

  if (!clicked) {
    console.log(`[${height}] SKIP - radio button not found`)
    continue
  }

  await new Promise(r => setTimeout(r, 1500))

  const info = await page.evaluate(() => {
    const wrapper = document.querySelector('.table-wrapper')
    if (!wrapper) return { error: 'No .table-wrapper found' }

    const tableComponent = wrapper.querySelector('.table_component')
    if (!tableComponent) return { error: 'No .table_component found' }

    const pagination = tableComponent.querySelector('.pagination_page')
    if (!pagination) return { error: 'No .pagination_page found' }

    const tcRect = tableComponent.getBoundingClientRect()
    const pagRect = pagination.getBoundingClientRect()

    const tableBody = tableComponent.querySelector('.ant-table-body')
    const bodyRect = tableBody ? tableBody.getBoundingClientRect() : null

    return {
      container: { top: tcRect.top, bottom: tcRect.bottom, height: tcRect.height },
      pagination: { top: pagRect.top, bottom: pagRect.bottom, height: pagRect.height },
      tableBody: bodyRect ? { top: bodyRect.top, bottom: bodyRect.bottom, height: bodyRect.height } : null,
      pagInContainer: pagRect.bottom <= tcRect.bottom + 2,
      pagNotOverlapping: bodyRect ? bodyRect.bottom <= pagRect.top + 2 : null,
      pagVisible: pagRect.height > 0 && pagRect.width > 0
    }
  })

  results[height] = info
  console.log(`\n[${height}]`)
  console.log(`  Container height: ${info.container?.height?.toFixed(0)}px`)
  console.log(`  Pagination visible: ${info.pagVisible}`)
  console.log(`  Pagination in container: ${info.pagInContainer}`)
  console.log(`  No overlap (body.bottom <= pag.top): ${info.pagNotOverlapping}`)
  if (info.tableBody) {
    console.log(`  Table body: ${info.tableBody.top?.toFixed(0)}-${info.tableBody.bottom?.toFixed(0)} (${info.tableBody.height?.toFixed(0)}px)`)
  }
  console.log(`  Pagination: ${info.pagination?.top?.toFixed(0)}-${info.pagination?.bottom?.toFixed(0)} (${info.pagination?.height?.toFixed(0)}px)`)
}

console.log('\n=== SUMMARY ===')
for (const [h, info] of Object.entries(results)) {
  const ok = info.pagVisible && info.pagInContainer && info.pagNotOverlapping
  console.log(`${h}: ${ok ? 'PASS' : 'FAIL'} (visible=${info.pagVisible}, inContainer=${info.pagInContainer}, noOverlap=${info.pagNotOverlapping})`)
}

await browser.close()
process.exit(0)
