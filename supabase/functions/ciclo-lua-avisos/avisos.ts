// Decide se a Lua tem algo para avisar agora. Sem banco e sem rede, para poder ser testado sozinho.
// Os dados são os mesmos que o app Ciclo guarda em ciclo_dados.dados.

const FUSO = "America/Sao_Paulo";
export const MAX_AVISOS_POR_DIA = 5;
const JANELA_HORAS = 0.75;
const META_COPOS = 10;

type Tipo = "agua" | "comida" | "treino" | "dormir";
interface Horario { id: string; tipo: Tipo; hora: number; chave: string }

// Em ordem. A chave é a mesma que o app usa para "já fiz" e "agora não".
const HORARIOS: Horario[] = [
  { id: "agua-manha", tipo: "agua", hora: 10.5, chave: "sede" },
  { id: "almoco", tipo: "comida", hora: 12.5, chave: "almoco" },
  { id: "agua-tarde", tipo: "agua", hora: 16, chave: "sede" },
  { id: "treino", tipo: "treino", hora: 18, chave: "treino" },
  { id: "jantar", tipo: "comida", hora: 20, chave: "jantar" },
  { id: "dormir", tipo: "dormir", hora: 22.5, chave: "dormir" },
];

const FALAS: Record<string, string> = {
  "agua-manha": "Tô com sede! Vamos tomar um copo de água?",
  "agua-tarde": "Tô secando aqui! Toma um copo de água comigo?",
  almoco: "Minha barriga roncou! Já almoçou?",
  jantar: "Já jantou? Eu janto luz de estrela, mas você precisa de comida de verdade.",
  treino: "Bora mexer o corpo? Até um treino pequeno já vale.",
  dormir: "Tô com sono… Vamos dormir?",
};

export interface Aviso { id: string; titulo: string; corpo: string }

// Data e hora em Brasília, seja qual for o relógio do servidor
function horaLocal(agora: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(agora);
  const v = (t: string) => partes.find((p) => p.type === t)!.value;
  return { dia: `${v("year")}-${v("month")}-${v("day")}`, hora: Number(v("hour")) + Number(v("minute")) / 60 };
}

export function diaLocal(agora: Date) {
  return horaLocal(agora).dia;
}

function coposEsperados(h: number) {
  if (h < 7.5) return 0;
  if (h >= 21) return META_COPOS;
  return Math.round((h - 7.5) / 13.5 * META_COPOS);
}

// deno-lint-ignore no-explicit-any
export function avisoDoMomento(dados: any, agora: Date, enviados: string[]): Aviso | null {
  if (enviados.length >= MAX_AVISOS_POR_DIA) return null;
  const perfil = (dados?.profiles || []).find((p: { id: string }) => p.id === dados.current);
  if (!perfil) return null;

  const { dia, hora } = horaLocal(agora);
  const diaUTC = agora.toISOString().slice(0, 10); // dor e humor são guardados assim pelo app
  const m = perfil.mascote || {};
  const preferencias = m.avisos || {};
  const feitos = m.feitos?.[dia] || {};
  const adiados = m.adiados || {};
  const dor = perfil.pain_log?.[diaUTC] ?? perfil.pain_log?.[dia];
  const humor = perfil.mood_log?.[diaUTC] ?? perfil.mood_log?.[dia];
  const pegaLeve = dor >= 5 || humor === "triste";

  for (const h of HORARIOS) {
    if (hora < h.hora || hora >= h.hora + JANELA_HORAS) continue;
    if (enviados.includes(h.id) || preferencias[h.tipo] === false) continue;
    if (feitos[h.chave] || adiados[h.chave] > agora.getTime()) continue;
    if (h.tipo === "agua") {
      const copos = m.agua?.[dia] || 0;
      if (copos >= META_COPOS || coposEsperados(hora) - copos < 2) continue;
    }
    if (h.tipo === "treino" && (perfil.workout_log?.[dia] || pegaLeve)) continue;
    return { id: h.id, titulo: `🌙 ${m.nome || "Lua"}`, corpo: FALAS[h.id] };
  }
  return null;
}
