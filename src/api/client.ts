import axios from 'axios'

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://127.0.0.1:8000'
export const webSocketUrl = import.meta.env.VITE_WS_URL?.trim() || 'ws://127.0.0.1:8000/ws/attacks'
export const webSocketEnabled = import.meta.env.VITE_ENABLE_WS === 'true'
const inFlightRequests = new Map<string, Promise<unknown>>()

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 8000,
  headers: {
    Accept: 'application/json',
  },
})

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return '请求超时'
    if (error.response?.status) return `HTTP ${error.response.status}`
    return error.message || '接口不可用'
  }
  return error instanceof Error ? error.message : '接口不可用'
}

export async function requestApi<T>(
  request: () => Promise<T>,
  label: string,
  dedupeKey?: string,
): Promise<T> {
  if (dedupeKey) {
    const existing = inFlightRequests.get(dedupeKey)
    if (existing) return existing as Promise<T>
  }

  const promise = request()

  if (dedupeKey) {
    inFlightRequests.set(dedupeKey, promise)
  }

  try {
    return await promise
  } catch (error) {
    console.warn(`${label} failed: ${getErrorMessage(error)}`)
    throw error
  } finally {
    if (dedupeKey) inFlightRequests.delete(dedupeKey)
  }
}
