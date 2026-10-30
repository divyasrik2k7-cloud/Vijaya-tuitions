import { supabase } from './supabase'
export async function openFile(bucket: string, path: string): Promise<boolean> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60)
  if (error || !data) return false
  const a = document.createElement('a'); a.href = data.signedUrl; a.target = '_blank'; a.rel = 'noopener'; a.click(); return true
}
