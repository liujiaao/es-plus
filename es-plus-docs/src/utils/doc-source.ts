// 「编辑此页 / 报告问题 / 最后更新」的取数口：仓库地址只有这一处，
// 三个文档页（指南 / 组件 / 高级）共用，避免每页各写一个 GitHub 链接。
// 最后更新时间来自构建期注入的 __ES_DOC_META__（见 scripts/doc-meta.mjs）。

export const REPO_URL = 'https://github.com/liujiaao/es-plus'
export const REPO_BRANCH = 'master'

/** 编辑此页：指向该页正文所在的源文件（不是渲染后的 URL） */
export function editUrlFor(pathInRepo: string): string {
  return `${REPO_URL}/blob/${REPO_BRANCH}/${pathInRepo}`
}

/** 报告问题：把页面标题与当前地址预填进 issue 正文，省得读者自己抄 */
export function issueUrlFor(title: string): string {
  const href = typeof window === 'undefined' ? '' : window.location.href
  const query = new URLSearchParams({
    title: `[文档] ${title}`,
    body: `页面：${href}\n\n问题描述：\n`,
  })
  return `${REPO_URL}/issues/new?${query.toString()}`
}

const INJECTED: Record<string, string> =
  typeof __ES_DOC_META__ === 'undefined' ? {} : __ES_DOC_META__

/** 页面键 → YYYY-MM-DD；没有数据时返回空串（页面就不显示时间，不编一个假日期） */
export function lastUpdatedFor(key: string): string {
  return INJECTED[key] || ''
}
