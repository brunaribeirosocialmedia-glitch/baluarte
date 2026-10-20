import { NavLink } from 'react-router-dom'
import { formatarData, hojeISO, paraISO } from '../../lib/datas'

export const STATUS = {
  frio: 'Frio',
  morno: 'Morno',
  quente: 'Quente',
}

// Jornada: em que pé está a conversa (a temperatura continua à parte)
export const ETAPAS = {
  a_contatar: 'A contatar',
  primeiro_contato: 'Primeiro contato feito',
  em_conversa: 'Em conversa',
  reuniao: 'Reunião / diagnóstico',
  proposta: 'Proposta enviada',
  negociacao: 'Negociação',
  fechado: 'Fechado',
  perdido: 'Perdido',
}

export const CANAIS = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  email: 'E-mail',
  ligacao: 'Ligação',
  presencial: 'Presencial',
  outro: 'Outro',
}

export const fechado = (p) => p.etapa === 'fechado' || p.valor_fechado != null
export const encerrado = (p) => fechado(p) || p.etapa === 'perdido'

// Próximo contato em relação a hoje: atrasado, hoje ou em breve (até 3 dias)
export function situacaoContato(p) {
  if (!p.proximo_contato || encerrado(p)) return ''
  const hoje = hojeISO()
  if (p.proximo_contato < hoje) return 'atrasado'
  if (p.proximo_contato === hoje) return 'hoje'
  const emTres = new Date()
  emTres.setDate(emTres.getDate() + 3)
  return p.proximo_contato <= paraISO(emTres) ? 'em-breve' : ''
}

export const precisaContatar = (p) => ['atrasado', 'hoje'].includes(situacaoContato(p))

export function ProximoContato({ prospect, comPasso = true }) {
  if (!prospect.proximo_contato) return <span className="texto-suave">—</span>
  const situacao = situacaoContato(prospect)
  const rotulo = situacao === 'hoje' ? 'Hoje' : situacao === 'atrasado' ? `Atrasado · ${formatarData(prospect.proximo_contato)}` : formatarData(prospect.proximo_contato)
  return (
    <span className="proximo-contato">
      <span className={`prazo ${situacao}`}>{rotulo}</span>
      {comPasso && prospect.proximo_passo && <small className="texto-suave">{prospect.proximo_passo}</small>}
    </span>
  )
}

export function AbasProspeccao() {
  return (
    <nav className="abas abas-prospeccao">
      <NavLink to="/comercial" end className="aba">Pipeline</NavLink>
      <NavLink to="/comercial/roteiros" className="aba">Roteiros</NavLink>
    </nav>
  )
}

export function SeloStatus({ status }) {
  return <span className={`selo-status status-${status}`}>{STATUS[status]}</span>
}

// Botões Frio / Morno / Quente
export function EscolhaStatus({ valor, onChange }) {
  return (
    <div className="escolha-status" role="radiogroup" aria-label="Temperatura">
      {Object.entries(STATUS).map(([v, nome]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          className={`selo-status status-${v} ${valor === v ? 'marcado' : ''}`}
          onClick={() => onChange(v)}
        >
          {nome}
        </button>
      ))}
    </div>
  )
}

// Trilha das etapas: as já percorridas ficam marcadas
export function TrilhaEtapas({ valor, onChange }) {
  const ordem = Object.keys(ETAPAS)
  const atual = ordem.indexOf(valor)
  return (
    <ol className="trilha-etapas" aria-label="Etapa da jornada">
      {ordem.map((v, i) => (
        <li key={v}>
          <button
            type="button"
            aria-current={valor === v ? 'step' : undefined}
            className={`etapa-${v} ${valor === v ? 'atual' : ''} ${i < atual && valor !== 'perdido' ? 'feita' : ''}`}
            onClick={() => onChange(v)}
          >
            {ETAPAS[v]}
          </button>
        </li>
      ))}
    </ol>
  )
}
