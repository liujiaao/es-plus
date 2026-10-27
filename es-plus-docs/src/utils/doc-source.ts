// 「编辑此页 / 报告问题 / 最后更新」的取数口。
//
// 实现放在三站共用的 docs/theme/doc-chrome.js 里（经 scripts/sync-theme.mjs 分发），
// 这里只做转出：es-pc / es-eui 接 chrome 时用的是同一个 editUrlFor / issueUrlFor，
// 免得三站各写一套 GitHub 链接，issue 标题格式与「编辑此页」指向的文件迟早分叉。
export { REPO_URL, REPO_BRANCH, editUrlFor, issueUrlFor, lastUpdatedFor } from './doc-chrome.js'
