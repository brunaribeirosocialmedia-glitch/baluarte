import { NavLink, Outlet } from 'react-router-dom'
import { Biblioteca } from '../Socorro'

// Área Gestão: tudo que é da B Mídia como empresa. Usa o mesmo código/permissão do antigo Financeiro.
const ABAS = [
  { para: 'financeiro', nome: 'Financeiro' },
  { para: 'contratos', nome: 'Contratos' },
  { para: 'obrigacoes', nome: 'Obrigações' },
  { para: 'documentos', nome: 'Documentos' },
  { para: 'esteira', nome: 'Esteira de produtos' },
  { para: 'metas', nome: 'Metas' },
]

export default function Gestao() {
  return (
    <div className="area-cliente">
      <header className="area-topo">
        <h1>Gestão</h1>
        <nav className="abas">
          {ABAS.map((a) => <NavLink key={a.para} to={a.para} className="aba">{a.nome}</NavLink>)}
        </nav>
      </header>
      <div className="area-conteudo">
        <Outlet />
      </div>
    </div>
  )
}

// Textos de referência da agência (vindos do Trello), no formato da Caixa de Pandora
export function EsteiraProdutos() {
  return <Biblioteca secao="gestao-esteira" notas novoTexto="Novo produto" />
}

export function MetasGestao() {
  return <Biblioteca secao="gestao-metas" quadro checavel />
}
