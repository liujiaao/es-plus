/**
 * Shared mock API utilities for documentation examples.
 * Provides local fallback data when external APIs (fakestoreapi.com) are unavailable.
 */

const FALLBACK_PRODUCTS = [
  { id: 1, title: 'Wireless Bluetooth Headphones', price: 59.99, category: 'electronics', description: 'Premium wireless headphones with noise cancellation', image: '' },
  { id: 2, title: 'Cotton T-Shirt', price: 19.99, category: "men's clothing", description: 'Classic cotton crew neck t-shirt', image: '' },
  { id: 3, title: 'Stainless Steel Watch', price: 129.99, category: 'jewelery', description: 'Elegant stainless steel analog watch', image: '' },
  { id: 4, title: 'Laptop Backpack', price: 49.99, category: 'electronics', description: 'Durable laptop backpack with USB charging port', image: '' },
  { id: 5, title: 'Running Shoes', price: 89.99, category: "men's clothing", description: 'Lightweight breathable running shoes', image: '' },
  { id: 6, title: 'Yoga Mat', price: 29.99, category: "women's clothing", description: 'Non-slip premium yoga mat', image: '' },
  { id: 7, title: 'Silver Necklace', price: 79.99, category: 'jewelery', description: 'Sterling silver pendant necklace', image: '' },
  { id: 8, title: 'Wireless Mouse', price: 24.99, category: 'electronics', description: 'Ergonomic wireless optical mouse', image: '' },
  { id: 9, title: 'Denim Jacket', price: 69.99, category: "women's clothing", description: 'Classic denim jacket with button closure', image: '' },
  { id: 10, title: 'Portable Speaker', price: 39.99, category: 'electronics', description: 'Waterproof bluetooth portable speaker', image: '' },
  { id: 11, title: 'Leather Wallet', price: 34.99, category: "men's clothing", description: 'Genuine leather bifold wallet', image: '' },
  { id: 12, title: 'Gold Ring', price: 199.99, category: 'jewelery', description: '14k gold plated fashion ring', image: '' },
]

export async function fetchProducts(): Promise<any[]> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch('https://fakestoreapi.com/products', { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) throw new Error('API error')
    return await res.json()
  } catch {
    return FALLBACK_PRODUCTS
  }
}

export async function fetchProductsPaginated(params: {
  pageIndex?: number
  pageSize?: number
  keyword?: string
  category?: string
}): Promise<{ data: any[]; total: number; pageIndex: number; pageSize: number }> {
  const { pageIndex = 1, pageSize = 10, keyword = '', category = '' } = params
  const allProducts = await fetchProducts()

  let filtered = allProducts
  if (keyword) {
    filtered = filtered.filter(p => p.title.toLowerCase().includes(keyword.toLowerCase()))
  }
  if (category) {
    filtered = filtered.filter(p => p.category === category)
  }

  const total = filtered.length
  const start = (pageIndex - 1) * pageSize
  const data = filtered.slice(start, start + pageSize)

  return { data, total, pageIndex, pageSize }
}

export function getProductCategories(): string[] {
  return [...new Set(FALLBACK_PRODUCTS.map(p => p.category))]
}

// ─── jsonplaceholder 风格本地 mock ───────────────────────────
// AsyncOptions / Pagination 等示例此前直连 jsonplaceholder.typicode.com，
// 断网或被墙时静默空白。这里提供同形的本地数据与延迟，保证示例始终可用。

// 省份示例：crtn 读 item.address.city || item.name
const FALLBACK_USERS = [
  { id: 1, name: '张三', address: { city: '北京' } },
  { id: 2, name: '李四', address: { city: '上海' } },
  { id: 3, name: '王五', address: { city: '广州' } },
  { id: 4, name: '赵六', address: { city: '深圳' } },
  { id: 5, name: '钱七', address: { city: '杭州' } },
  { id: 6, name: '孙八', address: { city: '成都' } },
  { id: 7, name: '周九', address: { city: '武汉' } },
  { id: 8, name: '吴十', address: { city: '南京' } },
  { id: 9, name: '郑十一', address: { city: '西安' } },
  { id: 10, name: '冯十二', address: { city: '重庆' } },
]

// 城市/分页示例：posts 结构（id/title/body/userId）
const FALLBACK_POSTS = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  title: `本地示例文章 ${i + 1}`,
  body: `这是第 ${i + 1} 条本地兜底内容，断网时也用于演示分页与远程搜索，不依赖外部接口。`,
  userId: (i % 10) + 1,
}))

// 区县示例：albums 结构（id/title/userId）
const FALLBACK_ALBUMS = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  title: `本地示例相册 ${i + 1}`,
  userId: (i % 10) + 1,
}))

/** 模拟异步接口延迟，保持与真实请求一致的 loading 体验 */
function mockDelay<T>(data: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

/** 用户列表（AsyncOptions 省份示例的本地兜底） */
export function fetchMockUsers(): Promise<any[]> {
  return mockDelay(FALLBACK_USERS)
}

/** 文章列表（AsyncOptions 城市示例的本地兜底） */
export function fetchMockPosts(): Promise<any[]> {
  return mockDelay(FALLBACK_POSTS)
}

/** 相册列表（AsyncOptions 区县示例的本地兜底） */
export function fetchMockAlbums(): Promise<any[]> {
  return mockDelay(FALLBACK_ALBUMS)
}

/** 分页文章（Pagination 示例的本地兜底，替代 jsonplaceholder 直连） */
export function fetchPostsPaginated(params: {
  pageIndex?: number
  pageSize?: number
}): Promise<{ data: any[]; total: number; pageIndex: number; pageSize: number }> {
  const { pageIndex = 1, pageSize = 10 } = params
  const start = (pageIndex - 1) * pageSize
  return mockDelay({
    data: FALLBACK_POSTS.slice(start, start + pageSize),
    total: FALLBACK_POSTS.length,
    pageIndex,
    pageSize,
  })
}
