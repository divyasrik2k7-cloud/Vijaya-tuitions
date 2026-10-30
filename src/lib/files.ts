export const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg']
export function validateFile(f: { name: string; size: number }): string | null {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
  if (!f.name.includes('.') || !ALLOWED.includes(ext)) return 'File type not allowed'
  if (f.size === 0) return 'File is empty'
  if (f.size > MAX_BYTES) return 'File is larger than 10 MB'
  return null
}
export const safeName = (n: string) => n.replace(/[^A-Za-z0-9._-]/g, '_').slice(-100)
