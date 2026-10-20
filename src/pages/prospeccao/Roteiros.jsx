import { Biblioteca } from '../Socorro'
import { AbasProspeccao } from './comum'

// Exemplos de mensagens e estilos de abordagem; só quem tem o Comercial liberado vê
export default function Roteiros() {
  return (
    <Biblioteca
      secao="prospeccao-roteiros"
      titulo="Roteiros"
      descricao="Exemplos de mensagens e estilos de abordagem para copiar e adaptar."
      novoTexto="Novo roteiro"
      antes={<AbasProspeccao />}
    />
  )
}
