/**
 * `llms.txt` 与每页 `.md` 镜像的渲染规则（纯函数：生成器与门禁共用同一份）。
 *
 * 两条原则：
 *   1. **不做二次创作**。镜像里的每一句话都来自真源 —— 指南就是源 markdown 原文，
 *      组件页就是把 `component-doc.data.ts` 里那张表按表渲染出来。镜像里出现的
 *      内容必须能在源里找到，否则它就成了第二个真源，改一处漏一处。
 *   2. **产物可逐字节复算**。所有渲染都是确定的（不读时间、不读随机序），门禁因此
 *      可以「重新生成一遍再比对」，人手改过的镜像会在 CI 里立刻变红。
 */

/** 统一行尾：仓库 blob 是 LF，Windows 检出是 CRLF，产物不能跟着平台漂 */
export const normalizeEol = (text) => text.replace(/\r\n?/g, '\n')

/** YAML 单引号标量：内部单引号翻倍。标题里有冒号/引号也不会把 front matter 写坏 */
const yamlString = (value) => `'${String(value).replace(/'/g, "''")}'`

/** front matter：键顺序即调用方给出的顺序（Map 之外不排序，保持可复算） */
export function frontMatter(fields) {
  const lines = Object.entries(fields).map(([key, value]) => `${key}: ${yamlString(value)}`)
  return ['---', ...lines, '---', ''].join('\n')
}

/**
 * 去掉行内 markdown 标记，只留可读文本（给 llms.txt 的摘要用，**不用于正文**）。
 *
 * 刻意不清洗 `<…>`：本站文档里 `<es-form />`、`<svg><use>` 这类片段是**代码**。
 * 按 HTML 标签删掉会把句子洗成半截 —— 第一版真的产出过
 * 「业务里不必再各写一套 。」这种断句（源里是「各写一套 `<svg><use>`」）。
 */
export function plain(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/(^|\s)[*_]([^*_]+)[*_]/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 正文里的一句话：只压空白，**保留行内 markdown**（反引号与尖括号都是信息）。
 * 用于组件页的能力 / 示例 / 主题 / 可访问性 / 相关 —— 那里的一句话会被读者当文档读，
 * 不该被摘要用的清洗规则削掉代码片段。
 */
const prose = (text) => String(text ?? '').replace(/\s*\n\s*/g, ' ').trim()

/**
 * 取一句话摘要（llms.txt 每条要一句说明）。
 *
 * 摘要是**从正文算**的，不是在表里另写一句：另写一句就等于同一件事有两处描述，
 * 正文改了摘要不改，读者点进去看到的和索引里写的对不上。
 *
 * 优先级：
 *   1. 标题之后紧跟着的 **blockquote** —— 本站文档的约定就是「标题 + 一句话总结」，
 *      那是作者自己写的那一句，比机器截取的第一段更准（why-es-plus 的
 *      「一句话总结：…」、changelog 的「本页由 … 生成」都在这里）；
 *   2. 没有 blockquote 时取第一段正文；
 *   3. 第一段以冒号结尾（「本文涵盖两类迁移：」）且紧跟着列表时，把列表前两条接上 ——
 *      否则摘要停在冒号上，等于没说。
 */
export function docSummary(markdown, max = 160) {
  const lines = normalizeEol(markdown).split('\n').map((line) => line)

  // 找到标题之后的第一个「实块」：blockquote / 段落 / 列表 / 代码，先出现的说了算
  let i = 0
  while (i < lines.length && (!lines[i].trim() || lines[i].trim().startsWith('#'))) i++

  if (i < lines.length && lines[i].trim().startsWith('>')) {
    const quote = []
    while (i < lines.length && lines[i].trim().startsWith('>')) quote.push(lines[i++].trim().replace(/^>\s?/, ''))
    return truncate(plain(quote.join(' ')), max)
  }

  // 跳过代码块 / 表格 / 制表符块，直到第一段正文
  let fenced = false
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line.startsWith('```') || line.startsWith('~~~')) {
      fenced = !fenced
      i++
      continue
    }
    if (fenced) {
      i++
      continue
    }
    if (!line || line.startsWith('#') || line.startsWith('|') || line.startsWith('<!--') || line.startsWith('---')) {
      i++
      continue
    }
    if (/^([-*+]\s|\d+\.\s)/.test(line) || /^<[a-zA-Z!/]/.test(line)) {
      i++
      continue
    }
    break
  }

  const para = []
  while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith('```')) para.push(lines[i++])
  let text = plain(para.join(' '))

  // 「…两类迁移：」+ 紧跟的有序/无序列表 —— 把前两条接上去，别停在冒号
  if (/[:：]$/.test(text)) {
    while (i < lines.length && !lines[i].trim()) i++
    const items = []
    while (i < lines.length && /^([-*+]\s|\d+\.\s)/.test(lines[i].trim()) && items.length < 2) {
      items.push(plain(lines[i].trim().replace(/^([-*+]\s|\d+\.\s)/, '')))
      i++
    }
    if (items.length) text = `${text}${items.join('；')}`
  }

  return truncate(text, max)
}

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** 表格单元格：竖线必须转义，否则会把列切断；换行压成空格（GFM 不支持格内换行） */
const cell = (value) => String(value ?? '-').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim() || '-'

const COLUMN_ORDER = ['name', 'type', 'default', 'params', 'desc']
const COLUMN_HEAD = { name: '名称', type: '类型', default: '默认值', params: '参数', desc: '说明' }

/** 一组 API 行 → markdown 表（列按实际出现过的键取，顺序固定） */
export function apiTable(rows) {
  const present = COLUMN_ORDER.filter((key) => rows.some((row) => row[key] !== undefined))
  const columns = present.length ? present : COLUMN_ORDER
  const head = `| ${columns.map((c) => COLUMN_HEAD[c]).join(' | ')} |`
  const rule = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${columns.map((c) => cell(row[c])).join(' | ')} |`)
  return [head, rule, ...body].join('\n')
}

/** 指南页镜像：源 markdown 原文 + front matter（正文一个字节都不改） */
export function renderGuide({ title, route, canonical, source, body }) {
  // frontMatter 自己以换行收尾，这里直接拼，不再 join —— 否则正文前会多一行空行，
  // 而「多一行空行」在浏览器里看不出来，只有逐字节比对能发现。
  return `${frontMatter({ title, route, canonical, source, type: 'guide' })}${normalizeEol(body).trimEnd()}\n`
}

/**
 * 把一节 API 渲染成「表格，或者一句为什么没有」。
 *
 * 空表不是错误：`notes` 里写着原因（EsForm 不派发事件、SvgIcon 不提供插槽…）。
 * 有 note 就引用 note，没有就整节省略 —— 宁可少一节，也不替组件编一条。
 */
function apiSection(name, rows, note) {
  const lines = [`### ${name}`, '']
  if (rows.length) {
    lines.push(apiTable(rows))
  } else if (note) {
    lines.push(`> ${note}`)
  } else {
    return []
  }
  lines.push('')
  return lines
}

/**
 * 组件页 / 高级用法页的镜像（内容来自站点渲染同一份数据对象）。
 *
 * 不含示例源码：示例是 `.vue` 文件，镜像只承载「有哪些示例」。
 * 把源码也镜像进来又要多一条分发链路，而源码在仓库里本来就能读到。
 */
export function renderApiPage({ kind, route, canonical, data }) {
  const lines = [
    frontMatter({ title: data.title, route, canonical, source: `es-plus-docs/src/views/${kind === 'component' ? 'component-doc' : 'advanced-doc'}.data.ts`, type: kind }),
    `# ${data.title}`,
    '',
    `> ${prose(data.description ?? '')}`,
    '',
  ]

  if (data.features?.length) {
    lines.push('## 能力', '')
    for (const f of data.features) lines.push(`- **${f.name}** —— ${prose(f.desc)}`)
    lines.push('')
  }

  if (data.examples?.length) {
    lines.push('## 示例', '')
    for (const ex of data.examples) lines.push(`- ${ex.title} —— ${prose(ex.description ?? '')}`)
    lines.push('')
  }

  const notes = data.notes ?? {}
  if (data.api && Object.keys(data.api).length) {
    lines.push('## API', '')
    for (const [name, rows] of Object.entries(data.api)) {
      // api 里既可能是行数组，也可能是嵌套表（EsCrudPage 的 CrudPageSchema）
      if (Array.isArray(rows)) lines.push(...apiSection(name, rows, notes[name]))
    }
    lines.push('')
  }

  if (data.theme) {
    lines.push('## 主题（CSS 变量）', '')
    if (data.theme.note) lines.push(`> ${prose(data.theme.note)}`, '')
    if (data.theme.vars?.length) {
      lines.push('| 变量 | 默认值 | 说明 |', '| --- | --- | --- |')
      for (const v of data.theme.vars) lines.push(`| \`${v.name}\` | ${cell(v.fallback)} | ${cell(prose(v.desc ?? ''))} |`)
      lines.push('')
    } else if (data.theme.inherit) {
      lines.push(`继承：${data.theme.inherit}`, '')
    } else if (data.theme.fixedColors) {
      lines.push('颜色写死，没有开放变量 —— 宿主需自行覆盖。', '')
    }
  }

  if (data.a11y?.length) {
    lines.push('## 可访问性', '')
    for (const item of data.a11y) {
      const evidence = item.evidence ? `（证据：\`${item.evidence.file}\` 含 \`${item.evidence.contains}\`）` : ''
      lines.push(`- ${prose(item.text)}${evidence}`)
    }
    lines.push('')
  }

  if (data.related?.length) {
    lines.push('## 相关', '')
    for (const rel of data.related) {
      lines.push(`- **${rel.key}**（/components/${rel.key}）—— ${prose(rel.why)}`)
    }
    lines.push('')
  }

  if (data.since) {
    lines.push('## 版本', '', '| 端 | 首个包含本组件的版本 |', '| --- | --- |')
    for (const [leg, version] of Object.entries(data.since)) lines.push(`| ${leg} | ${version} |`)
    lines.push('')
  }

  // 结尾压空行：上面每一节都以空行收尾，多压一次让文件以一个换行结束
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  lines.push('')
  return lines.join('\n')
}
