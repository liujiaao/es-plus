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
