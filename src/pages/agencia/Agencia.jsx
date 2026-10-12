import { NavLink, Outlet } from 'react-router-dom'
import { Biblioteca } from '../Socorro'

// Área Agência: precificação e metas da B Mídia. Usa a mesma liberação da Gestão (área 'financeiro').
const ABAS = [
  { para: 'precificacao', nome: 'Precificação e entrega' },
  { para: 'metas', nome: 'Metas' },
]

export default function Agencia() {
  return (
    <div className="area-cliente">
      <header className="area-topo">
        <h1>Agência</h1>
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

export function Precificacao() {
  return <Biblioteca secao="agencia-precificacao" />
}

export function MetasAgencia() {
  return <Biblioteca secao="agencia-metas" />
}
