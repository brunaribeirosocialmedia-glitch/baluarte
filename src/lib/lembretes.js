// Lembrete no celular (prospects em Aquecendo). Quem decide quando mandar é a nuvem:
// função baluarte-lembretes, de segunda a sexta às 9h (migration 35).
import { supabase } from './supabase'

// Mesma chave pública dos avisos do Ciclo (a privada fica nos segredos das funções)
const VAPID_PUBLICA = 'BFYZdKlm22te1NSKgMw71IP4VU9JCC3-x_2vC8k6MNzV6Xgpc2Co1rfQuhxZYTGji3kq7rWyU5ARntUMC2zsLP0'
const SW = './sw.js'

export const suportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
export const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function registrarServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register(SW).catch((e) => console.warn('[Baluarte] sw', e))
  }
}

function chaveParaBytes(b64) {
  const texto = atob(b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64.length / 4) * 4, '='))
  return Uint8Array.from(texto, (c) => c.charCodeAt(0))
}

// O iPhone às vezes demora ou não responde: depois de 2,5 s segue como se não houvesse inscrição
export async function inscricaoAtual() {
  if (!suportado()) return null
  const perguntar = async () => {
    const reg = await navigator.serviceWorker.getRegistration(SW)
    return reg ? reg.pushManager.getSubscription() : null
  }
  const limite = new Promise((ok) => setTimeout(() => ok(null), 2500))
  try { return await Promise.race([perguntar(), limite]) } catch (e) { console.warn('[Baluarte] lembrete', e); return null }
}

export async function ligar() {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('permissao')
  await navigator.serviceWorker.register(SW)
  const reg = await navigator.serviceWorker.ready
  const inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(VAPID_PUBLICA) })
  const j = inscricao.toJSON()
  const { error } = await supabase.from('baluarte_push_aparelhos').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth })
  if (error) { await inscricao.unsubscribe(); throw error }
}

export async function desligar() {
  const inscricao = await inscricaoAtual()
  if (!inscricao) return
  await supabase.from('baluarte_push_aparelhos').delete().eq('endpoint', inscricao.endpoint)
  await inscricao.unsubscribe()
}

export async function testar() {
  const { data, error } = await supabase.functions.invoke('baluarte-lembretes', { body: { teste: true } })
  if (!error && data?.entregues) return { ok: true }
  return { ok: false, detalhe: data?.erros?.[0] || data?.erro || error?.message || '' }
}
