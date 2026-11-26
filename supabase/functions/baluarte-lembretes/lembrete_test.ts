import { assertEquals } from "jsr:@std/assert@1";
import { montarLembrete, ordenar } from "./lembrete.ts";

Deno.test("sem ninguém em Aquecendo, não avisa", () => {
  assertEquals(montarLembrete([]), null);
});

Deno.test("um prospect: fala o nome", () => {
  const l = montarLembrete([{ empresa: "Loja Flor", proximo_contato: null }])!;
  assertEquals(l.titulo, "🔥 Hora de aquecer");
  assertEquals(l.corpo.startsWith("Loja Flor está em Aquecendo."), true);
});

Deno.test("dois ou três: lista com 'e'", () => {
  const l = montarLembrete([
    { empresa: "B", proximo_contato: null },
    { empresa: "A", proximo_contato: null },
  ])!;
  assertEquals(l.titulo, "🔥 2 prospects aquecendo");
  assertEquals(l.corpo.startsWith("A e B."), true);
});

Deno.test("mais de três: mostra três e conta o resto", () => {
  const l = montarLembrete(["A", "B", "C", "D", "E"].map((empresa) => ({ empresa, proximo_contato: null })))!;
  assertEquals(l.corpo.startsWith("A, B, C e mais 2."), true);
});

Deno.test("próximo toque mais perto vem primeiro, sem data por último", () => {
  const r = ordenar([
    { empresa: "Sem data", proximo_contato: null },
    { empresa: "Depois", proximo_contato: "2026-12-05" },
    { empresa: "Vencido", proximo_contato: "2026-11-20" },
  ]).map((p) => p.empresa);
  assertEquals(r, ["Vencido", "Depois", "Sem data"]);
});
