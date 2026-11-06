// Avisos da Lua (app pessoal Ciclo). Chamada de duas formas:
// • pelo agendador, com a senha em x-ciclo-segredo: confere todo mundo que ligou os avisos;
// • pelo próprio app, com o login da pessoa e { teste: true }: manda um aviso de teste só para ela.
import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.3";
import { avisoDoMomento, diaLocal } from "./avisos.ts";

const CORS = {
  "Access-Control-Allow-Origin": "https://brunaribeirosocialmedia-glitch.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

let servidor: webpush.ApplicationServer | null = null;
async function servidorPush() {
  if (!servidor) {
    const chaves = await webpush.importVapidKeys(JSON.parse(Deno.env.get("CICLO_VAPID_JWK")!), { extractable: false });
    servidor = await webpush.ApplicationServer.new({
      contactInformation: "https://brunaribeirosocialmedia-glitch.github.io/ciclo/",
      vapidKeys: chaves,
    });
  }
  return servidor;
}

interface Aparelho { endpoint: string; usuario_id: string; p256dh: string; auth: string }

// Devolve quantos aparelhos receberam. Aparelho que desistiu dos avisos sai da lista.
async function enviar(aparelhos: Aparelho[], titulo: string, corpo: string) {
  const app = await servidorPush();
  let entregues = 0;
  const erros: string[] = [];
  for (const a of aparelhos) {
    try {
      const inscricao = app.subscribe({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } });
      await inscricao.pushTextMessage(JSON.stringify({ titulo, corpo }), { ttl: 3600, urgency: webpush.Urgency.Normal });
      entregues++;
    } catch (e) {
      // deno-lint-ignore no-explicit-any
      const resposta = (e as any)?.response as Response | undefined;
      if (resposta && [404, 410].includes(resposta.status)) {
        await db.from("ciclo_push_aparelhos").delete().eq("endpoint", a.endpoint);
      } else {
        const detalhe = resposta ? `${resposta.status} ${await resposta.text().catch(() => "")}` : String(e);
        console.error("[avisos] falha no envio", detalhe);
        erros.push(detalhe.slice(0, 200));
      }
    }
  }
  return { entregues, erros };
}

async function rodada(agora: Date) {
  const { data: aparelhos, error } = await db.from("ciclo_push_aparelhos").select("*");
  if (error) throw error;
  const porUsuario = new Map<string, Aparelho[]>();
  for (const a of aparelhos as Aparelho[]) porUsuario.set(a.usuario_id, [...(porUsuario.get(a.usuario_id) || []), a]);

  const dia = diaLocal(agora);
  let enviados = 0;
  for (const [usuario, lista] of porUsuario) {
    const [{ data: linha }, { data: registro }] = await Promise.all([
      db.from("ciclo_dados").select("dados").eq("usuario_id", usuario).maybeSingle(),
      db.from("ciclo_push_envios").select("avisos").eq("usuario_id", usuario).eq("dia", dia).maybeSingle(),
    ]);
    const jaEnviados: string[] = registro?.avisos || [];
    const aviso = avisoDoMomento(linha?.dados, agora, jaEnviados);
    if (!aviso) continue;
    const { entregues } = await enviar(lista, aviso.titulo, aviso.corpo);
    if (!entregues) continue;
    await db.from("ciclo_push_envios").upsert({ usuario_id: usuario, dia, avisos: [...jaEnviados, aviso.id] });
    enviados++;
  }
  return enviados;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const segredo = Deno.env.get("CICLO_CRON_SEGREDO");
    if (segredo && req.headers.get("x-ciclo-segredo") === segredo) {
      return responder({ enviados: await rodada(new Date()) });
    }

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!user) return responder({ erro: "Não autorizado" }, 401);
    const { data: aparelhos } = await db.from("ciclo_push_aparelhos").select("*").eq("usuario_id", user.id);
    if (!aparelhos?.length) return responder({ erro: "Nenhum aparelho com avisos ligados" }, 400);
    return responder(await enviar(aparelhos as Aparelho[], "🌙 Lua", "Oi! Se isso chegou, nossos avisos estão funcionando."));
  } catch (e) {
    console.error("[avisos]", e);
    return responder({ erro: "Falha ao enviar" }, 500);
  }
});
