// Lembrete dos prospects em Aquecendo (Comercial do Baluarte). Chamada de duas formas:
// • pelo agendador (seg a sex, 9h), com a senha em x-ciclo-segredo: manda para todos os aparelhos ligados;
// • pelo próprio Baluarte, com o login da pessoa e { teste: true }: manda só para ela, na hora.
// Só recebe quem está ativo e é admin ou tem permissão no Comercial (os nomes são do Comercial).
// Reaproveita os segredos do Ciclo: CICLO_VAPID_JWK (chaves de notificação) e CICLO_CRON_SEGREDO.
import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.3";
import { montarLembrete, URL_COMERCIAL, type Lembrete, type ProspectAquecendo } from "./lembrete.ts";

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
      contactInformation: "https://brunaribeirosocialmedia-glitch.github.io/baluarte/",
      vapidKeys: chaves,
    });
  }
  return servidor;
}

interface Aparelho { endpoint: string; usuario_id: string; p256dh: string; auth: string }

// Devolve quantos aparelhos receberam. Aparelho que desistiu das notificações sai da lista.
async function enviar(aparelhos: Aparelho[], lembrete: Lembrete) {
  const app = await servidorPush();
  let entregues = 0;
  const erros: string[] = [];
  for (const a of aparelhos) {
    try {
      const inscricao = app.subscribe({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } });
      await inscricao.pushTextMessage(JSON.stringify(lembrete), { ttl: 6 * 3600, urgency: webpush.Urgency.Normal });
      entregues++;
    } catch (e) {
      // deno-lint-ignore no-explicit-any
      const resposta = (e as any)?.response as Response | undefined;
      if (resposta && [404, 410].includes(resposta.status)) {
        await db.from("baluarte_push_aparelhos").delete().eq("endpoint", a.endpoint);
      } else {
        const detalhe = resposta ? `${resposta.status} ${await resposta.text().catch(() => "")}` : String(e);
        console.error("[lembretes] falha no envio", detalhe);
        erros.push(detalhe.slice(0, 200));
      }
    }
  }
  return { entregues, erros };
}

// Quem pode receber: ativo e (admin ou com permissão no Comercial)
async function podeReceber(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const { data, error } = await db.from("perfis").select("id, papel, pode_prospeccao, ativo").in("id", ids);
  if (error) throw error;
  return new Set((data || []).filter((p) => p.ativo && (p.papel === "admin" || p.pode_prospeccao)).map((p) => p.id as string));
}

async function prospectsAquecendo() {
  const { data, error } = await db.from("prospects")
    .select("empresa, proximo_contato")
    .eq("etapa", "aquecendo")
    .is("pos_venda_motivo", null);
  if (error) throw error;
  return (data || []) as ProspectAquecendo[];
}

async function rodada() {
  const lembrete = montarLembrete(await prospectsAquecendo());
  if (!lembrete) return { enviados: 0, motivo: "ninguém em Aquecendo" };
  const { data: aparelhos, error } = await db.from("baluarte_push_aparelhos").select("*");
  if (error) throw error;
  const liberados = await podeReceber([...new Set((aparelhos as Aparelho[]).map((a) => a.usuario_id))]);
  return enviar((aparelhos as Aparelho[]).filter((a) => liberados.has(a.usuario_id)), lembrete);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const segredo = Deno.env.get("CICLO_CRON_SEGREDO");
    if (segredo && req.headers.get("x-ciclo-segredo") === segredo) {
      return responder(await rodada());
    }

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!user) return responder({ erro: "Não autorizado" }, 401);
    if (!(await podeReceber([user.id])).has(user.id)) return responder({ erro: "Sem permissão no Comercial" }, 403);
    const { data: aparelhos } = await db.from("baluarte_push_aparelhos").select("*").eq("usuario_id", user.id);
    if (!aparelhos?.length) return responder({ erro: "Nenhum aparelho com o lembrete ligado" }, 400);
    const lembrete = montarLembrete(await prospectsAquecendo()) || {
      titulo: "🔥 Lembrete ligado",
      corpo: "Ninguém em Aquecendo agora. Quando tiver, eu te lembro de segunda a sexta, às 9h.",
      url: URL_COMERCIAL,
    };
    return responder(await enviar(aparelhos as Aparelho[], lembrete));
  } catch (e) {
    console.error("[lembretes]", e);
    return responder({ erro: "Falha ao enviar" }, 500);
  }
});
