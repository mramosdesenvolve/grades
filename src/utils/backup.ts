import type { AppData } from '../types'

export function downloadJson(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `backup-grades-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function readJsonFile(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        if (
          !parsed.schools ||
          !parsed.teachers ||
          !parsed.classes ||
          !parsed.components ||
          !parsed.schedule
        ) {
          throw new Error('Arquivo de backup inválido: estrutura incompleta.')
        }
        resolve(parsed as AppData)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Falha ao ler arquivo JSON.'))
      }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.readAsText(file)
  })
}
