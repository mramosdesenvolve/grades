import { useEffect, useState } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored) return JSON.parse(stored) as T
    } catch (err) {
      console.error(`Falha ao ler localStorage[${key}]`, err)
    }
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (err) {
      console.error(`Falha ao salvar localStorage[${key}]`, err)
    }
  }, [key, value])

  return [value, setValue] as const
}
