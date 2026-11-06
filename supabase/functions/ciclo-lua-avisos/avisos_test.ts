import { avisoDoMomento, diaLocal } from "./avisos.ts";

// Horário de Brasília (UTC-3) num dia fixo
const em = (h: number, min = 0) => new Date(Date.UTC(2026, 10, 10, h + 3, min));
const DIA = "2026-11-10";
const dados = (extra = {}, mascote = {}) => ({ current: "p", profiles: [{ id: "p", ...extra, mascote }] });
const igual = (a: unknown, b: unknown) => {
  if (a !== b) throw new Error(`esperava ${b}, veio ${a}`);
};
const id = (d: unknown, agora: Date, enviados: string[] = []) => avisoDoMomento(d, agora, enviados)?.id ?? null;

Deno.test("dia é o de Brasília, não o do servidor", () => {
  igual(diaLocal(new Date(Date.UTC(2026, 10, 11, 1, 0))), DIA); // 22h de Brasília, já dia 11 em UTC
});
Deno.test("água sem nenhum copo às 10h30", () => igual(id(dados(), em(10, 30)), "agua-manha"));
Deno.test("água em dia: não pede", () => igual(id(dados({}, { agua: { [DIA]: 3 } }), em(10, 30)), null));
Deno.test("fora dos horários: silêncio", () => {
  igual(id(dados(), em(11, 30)), null);
  igual(id(dados(), em(14)), null);
  igual(id(dados(), em(23, 30)), null);
  igual(id(dados(), em(3)), null);
});
Deno.test("almoço e jantar", () => {
  igual(id(dados(), em(12, 30)), "almoco");
  igual(id(dados(), em(20)), "jantar");
});
Deno.test("'Já comi' no app cala o aviso", () => igual(id(dados({}, { feitos: { [DIA]: { almoco: true } } }), em(12, 30)), null));
Deno.test("'Agora não' no app cala o aviso enquanto valer", () => {
  igual(id(dados({}, { adiados: { almoco: em(13).getTime() } }), em(12, 30)), null);
  igual(id(dados({}, { adiados: { almoco: em(12).getTime() } }), em(12, 30)), "almoco");
});
Deno.test("treino às 18h, só se não treinou", () => {
  igual(id(dados(), em(18)), "treino");
  igual(id(dados({ workout_log: { [DIA]: { title: "t" } } }), em(18)), null);
});
Deno.test("com dor ou tristeza não cobra treino", () => {
  igual(id(dados({ pain_log: { [DIA]: 6 } }), em(18)), null);
  igual(id(dados({ mood_log: { [DIA]: "triste" } }), em(18)), null);
  igual(id(dados({ pain_log: { [DIA]: 2 } }), em(18)), "treino");
});
Deno.test("hora de dormir", () => igual(id(dados(), em(22, 30)), "dormir"));
Deno.test("não repete o que já foi enviado", () => igual(id(dados(), em(12, 30), ["almoco"]), null));
Deno.test("no máximo 5 por dia", () => igual(id(dados(), em(22, 30), ["a", "b", "c", "d", "e"]), null));
Deno.test("tipo desligado não avisa, os outros seguem", () => {
  const d = dados({}, { avisos: { comida: false } });
  igual(id(d, em(12, 30)), null);
  igual(id(d, em(18)), "treino");
});
Deno.test("usa o nome que a pessoa deu", () => {
  igual(avisoDoMomento(dados({}, { nome: "Lulu" }), em(12, 30), [])?.titulo, "🌙 Lulu");
});
Deno.test("sem perfil não quebra", () => {
  igual(avisoDoMomento({}, em(12, 30), []), null);
  igual(avisoDoMomento(null, em(12, 30), []), null);
});
