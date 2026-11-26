// Monta o texto do lembrete dos prospects em Aquecendo. Sem banco e sem rede, para poder ser testado sozinho.

export interface ProspectAquecendo { empresa: string; proximo_contato: string | null }
export interface Lembrete { titulo: string; corpo: string; url: string }

export const MAX_NOMES = 3;
export const URL_COMERCIAL = "https://brunaribeirosocialmedia-glitch.github.io/baluarte/#/comercial";

// Quem tem o próximo toque mais perto (ou vencido) vem primeiro; sem data vai para o fim
export function ordenar(lista: ProspectAquecendo[]) {
  return [...lista].sort((a, b) => {
    if (a.proximo_contato === b.proximo_contato) return a.empresa.localeCompare(b.empresa, "pt-BR");
    if (!a.proximo_contato) return 1;
    if (!b.proximo_contato) return -1;
    return a.proximo_contato.localeCompare(b.proximo_contato);
  });
}

function juntar(nomes: string[]) {
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

export function montarLembrete(lista: ProspectAquecendo[]): Lembrete | null {
  if (!lista.length) return null;
  const nomes = ordenar(lista).map((p) => p.empresa.trim()).filter(Boolean);
  if (nomes.length === 1) {
    return {
      titulo: "🔥 Hora de aquecer",
      corpo: `${nomes[0]} está em Aquecendo. Passa no Instagram e dá uma atenção: curtir, comentar, responder um story.`,
      url: URL_COMERCIAL,
    };
  }
  const mostrados = nomes.slice(0, MAX_NOMES);
  const resto = nomes.length - mostrados.length;
  const lista_ = resto > 0 ? `${mostrados.join(", ")} e mais ${resto}` : juntar(mostrados);
  return {
    titulo: `🔥 ${nomes.length} prospects aquecendo`,
    corpo: `${lista_}. Passa no Instagram e dá uma atenção pra eles hoje.`,
    url: URL_COMERCIAL,
  };
}
