import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { formatarData, hojeISO } from '../../lib/datas'
import { formatarMoeda } from '../../lib/moeda'
import Modal from '../../components/Modal'
import Icone from '../../components/Icone'
import CartaoMeta from '../../components/CartaoMeta'
import { competenciaDe, proximoMes } from '../../lib/metas'
import { AbasProspeccao, ETAPAS, EscolhaStatus, ProximoContato, STATUS, SeloStatus, emPosVenda, encerrado, fechado, precisaContatar } from './comum'

// Datas vazias vão para o fim em qualquer ordenação por data
const porData = (campo, sentido) => (a, b) => {
  if (!a[campo] || !b[campo]) return (a[campo] ? -1 : 0) + (b[campo] ? 1 : 0)
  return sentido * a[campo].localeCompare(b[campo])
}

const ORDENACOES = {
  proximo: { nome: 'Próximo contato', fn: porData('proximo_contato', 1) },
  ultimo: { nome: 'Sem contato há mais tempo', fn: porData('ultimo_contato', 1) },
  recentes: { nome: '1º contato mais recente', fn: porData('data_primeiro_contato', -1) },
  empresa: { nome: 'Empresa (A–Z)', fn: (a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR') },
  etapa: { nome: 'Etapa', fn: (a, b) => Object.keys(ETAPAS).indexOf(a.etapa) - Object.keys(ETAPAS).indexOf(b.etapa) },
  temperatura: { nome: 'Mais quentes primeiro', fn: (a, b) => ['quente', 'morno', 'frio', 'possivel'].indexOf(a.status) - ['quente', 'morno', 'frio', 'possivel'].indexOf(b.status) },
  valor: { nome: 'Maior valor estimado', fn: (a, b) => (b.valor_estimado || 0) - (a.valor_estimado || 0) },
}

const CHAVE_VISAO = 'baluarte-prospeccao-visao'
function lerVisao() {
  try { return localStorage.getItem(CHAVE_VISAO) === 'quadro' ? 'quadro' : 'lista' } catch { return 'lista' }
}

function NovoProspect({ aoFechar, aoCriar }) {
  const [form, setForm] = useState({
    empresa: '', responsavel: '', contato: '', status: 'frio', etapa: 'a_contatar',
    data_primeiro_contato: '', servico_pretendido: '', proximo_contato: hojeISO(), proximo_passo: '',
  })
  const [erro, setErro] = useState('')
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  async function salvar(e) {
    e.preventDefault()
    const dados = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]))
    if (dados.etapa === 'a_contatar') dados.data_primeiro_contato = null
    else dados.ultimo_contato = dados.data_primeiro_contato
    const { data, error } = await supabase.from('prospects').insert(dados).select().single()
    if (error) return setErro(traduzirErro(error))
    aoCriar(data)
  }

  const jaContatado = form.etapa !== 'a_contatar'

  return (
    <Modal
      titulo="Novo prospect"
      aoFechar={aoFechar}
      largura={560}
      rodape={
        <>
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-prospect" className="botao botao-principal" disabled={!form.empresa.trim() || (jaContatado && !form.data_primeiro_contato)}>Adicionar</button>
        </>
      }
    >
      <form id="form-prospect" className="formulario" onSubmit={salvar}>
        <label className="campo">
          <span>Nome da empresa</span>
          <input {...campo('empresa')} required autoFocus />
        </label>
        <div className="grade-campos">
          <label className="campo">
            <span>Nome do responsável</span>
            <input {...campo('responsavel')} />
          </label>
          <label className="campo">
            <span>Contato</span>
            <input {...campo('contato')} placeholder="WhatsApp, e-mail, @instagram" />
          </label>
          <label className="campo">
            <span>Etapa</span>
            <select
              value={form.etapa}
              onChange={(e) => setForm({ ...form, etapa: e.target.value, data_primeiro_contato: e.target.value === 'a_contatar' ? '' : form.data_primeiro_contato || hojeISO() })}
            >
              {Object.entries(ETAPAS).filter(([v]) => !['fechado', 'perdido'].includes(v)).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
          {jaContatado && (
            <label className="campo">
              <span>Data do primeiro contato</span>
              <input type="date" {...campo('data_primeiro_contato')} required />
            </label>
          )}
          <label className="campo">
            <span>{jaContatado ? 'Retomar em' : 'Entrar em contato em'}</span>
            <input type="date" {...campo('proximo_contato')} />
          </label>
          <label className="campo">
            <span>Serviço pretendido</span>
            <input {...campo('servico_pretendido')} placeholder="Gestão de Instagram, pacote de reels…" />
          </label>
        </div>
        <label className="campo">
          <span>Próximo passo</span>
          <input {...campo('proximo_passo')} placeholder="Mandar apresentação, cobrar resposta…" />
        </label>
        <div className="campo">
          <span>Temperatura</span>
          <EscolhaStatus valor={form.status} onChange={(status) => setForm({ ...form, status })} />
        </div>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

function CartaoProspect({ p, aoAbrir, aoArrastar, fantasma }) {
  return (
    <article
      className={`cartao-tarefa cartao-prospect ${fantasma ? 'fantasma' : ''}`}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; aoArrastar(p.id) }}
      onDragEnd={() => aoArrastar(null)}
      onClick={aoAbrir}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && aoAbrir()}
    >
      <p className="cartao-tarefa-titulo">{p.empresa}</p>
      {p.servico_pretendido && <small className="texto-suave">{p.servico_pretendido}</small>}
      <div className="cartao-tarefa-rodape">
        {p.etapa === 'fechado' && p.valor_fechado != null
          ? <strong className="valor-cartao">{formatarMoeda(p.valor_fechado)}</strong>
          : <ProximoContato prospect={p} comPasso={false} />}
        <SeloStatus status={p.status} />
      </div>
      {!encerrado(p) && p.proximo_passo && <small className="passo-cartao">{p.proximo_passo}</small>}
    </article>
  )
}

function Quadro({ prospects, aoAbrir, aoMover }) {
  const [arrastando, setArrastando] = useState(null)
  const [sobre, setSobre] = useState(null)

  return (
    <div className="board quadro-prospects">
      {Object.entries(ETAPAS).map(([etapa, nome]) => {
        const daEtapa = prospects.filter((p) => p.etapa === etapa)
        return (
          <section
            key={etapa}
            className={`coluna etapa-${etapa} ${sobre === etapa ? 'recebendo' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setSobre(etapa) }}
            onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setSobre(null)}
            onDrop={(e) => {
              e.preventDefault()
              setSobre(null)
              const id = e.dataTransfer.getData('text/plain')
              const p = prospects.find((x) => x.id === id)
              if (p && p.etapa !== etapa) aoMover(p, etapa)
            }}
          >
            <header className="coluna-topo">
              <span className="coluna-cor" />
              <h3>{nome}</h3>
              <span className="contador">{daEtapa.length}</span>
            </header>
            <div className="coluna-cartoes">
              {daEtapa.map((p) => (
                <CartaoProspect key={p.id} p={p} fantasma={arrastando === p.id} aoAbrir={() => aoAbrir(p)} aoArrastar={setArrastando} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default function ListaProspects() {
  const navigate = useNavigate()
  const [todos, setTodos] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')          // '' | contatar | frio | morno | quente | fechados | perdidos
  const [etapa, setEtapa] = useState('')
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState('proximo')
  const [visao, setVisao] = useState(lerVisao)
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    supabase.from('prospects').select('*').then(({ data, error }) => {
      if (error) setErro(traduzirErro(error))
      setTodos(data || [])
    })
  }, [])

  // Quem está no Pós-venda sai do Pipeline (mas o fechamento continua contando na meta)
  const prospects = useMemo(() => todos && todos.filter((p) => !emPosVenda(p)), [todos])

  function trocarVisao(v) {
    setVisao(v)
    try { localStorage.setItem(CHAVE_VISAO, v) } catch { /* sem armazenamento: só não lembra */ }
  }

  const mes = competenciaDe()
  const resumo = useMemo(() => {
    const lista = prospects || []
    const naoEncerrados = lista.filter((p) => !encerrado(p))
    const abertos = naoEncerrados.filter((p) => p.status !== 'possivel')   // possível ainda não foi confirmado
    const fechados = lista.filter(fechado)
    return {
      fechadoNoMes: (todos || [])
        .filter((p) => p.fechado_em >= mes && p.fechado_em < proximoMes(mes))
        .reduce((soma, p) => soma + Number(p.valor_fechado || 0), 0),
      total: lista.length,
      abertos: abertos.length,
      contatar: naoEncerrados.filter(precisaContatar).length,
      porStatus: Object.fromEntries(Object.keys(STATUS).map((s) => [s, naoEncerrados.filter((p) => p.status === s).length])),
      emNegociacao: abertos.reduce((soma, p) => soma + Number(p.valor_estimado || 0), 0),
      fechados: fechados.length,
      perdidos: lista.filter((p) => p.etapa === 'perdido' && !fechado(p)).length,
      valorFechado: lista.reduce((soma, p) => soma + Number(p.valor_fechado || 0), 0),
    }
  }, [todos, prospects, mes])

  const buscados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (prospects || []).filter((p) => !termo || [p.empresa, p.responsavel, p.contato, p.servico_pretendido, p.proximo_passo]
      .some((x) => (x || '').toLowerCase().includes(termo)))
  }, [prospects, busca])

  const visiveis = useMemo(() => buscados
    .filter((p) => {
      if (filtro === 'contatar') return precisaContatar(p)
      if (filtro === 'fechados') return fechado(p)
      if (filtro === 'perdidos') return p.etapa === 'perdido' && !fechado(p)
      if (filtro) return p.status === filtro && !encerrado(p)
      return true
    })
    .filter((p) => !etapa || p.etapa === etapa)
    .sort(ORDENACOES[ordem].fn), [buscados, filtro, etapa, ordem])

  async function atualizar(p, mudanca) {
    setTodos((atual) => atual.map((x) => (x.id === p.id ? { ...x, ...mudanca } : x)))
    const { error } = await supabase.from('prospects').update(mudanca).eq('id', p.id)
    if (error) {
      setErro(traduzirErro(error))
      setTodos((atual) => atual.map((x) => (x.id === p.id ? p : x)))
    }
  }

  const filtros = [
    { valor: '', nome: 'Todos', qtd: resumo.total },
    { valor: 'contatar', nome: 'Preciso contatar', qtd: resumo.contatar, alerta: resumo.contatar > 0 },
    ...Object.entries(STATUS).map(([v, nome]) => ({ valor: v, nome, qtd: resumo.porStatus[v] })),
    { valor: 'fechados', nome: 'Fechados', qtd: resumo.fechados },
    { valor: 'perdidos', nome: 'Perdidos', qtd: resumo.perdidos },
  ]

  return (
    <div className="pagina pagina-larga">
      <AbasProspeccao />
      <header className="pagina-topo linha-topo">
        <div>
          <h1>Comercial</h1>
          <p className="texto-suave">Pipeline de vendas da B Mídia.</p>
        </div>
        <button className="botao botao-principal" onClick={() => setCriando(true)}>
          <Icone nome="mais" tamanho={18} /> Novo prospect
        </button>
      </header>

      <div className="resumo-numeros">
        <div className="cartao numero">
          <span className="texto-suave">Em negociação</span>
          <strong>{resumo.abertos}</strong>
          <small className="texto-suave">{resumo.porStatus.quente} quente(s)</small>
        </div>
        <button className={`cartao numero numero-clicavel ${resumo.contatar ? 'com-alerta' : ''}`} onClick={() => setFiltro('contatar')}>
          <span className="texto-suave">Preciso contatar</span>
          <strong>{resumo.contatar}</strong>
          <small className="texto-suave">hoje ou atrasados</small>
        </button>
        <div className="cartao numero">
          <span className="texto-suave">Valor estimado em aberto</span>
          <strong>{formatarMoeda(resumo.emNegociacao)}</strong>
        </div>
        <div className="cartao numero">
          <span className="texto-suave">Fechados</span>
          <strong>{resumo.fechados}</strong>
          <small className="texto-suave">
            {resumo.total ? `${Math.round((100 * resumo.fechados) / resumo.total)}% de conversão · ${formatarMoeda(resumo.valorFechado)}` : '—'}
          </small>
        </div>
      </div>

      {prospects && <CartaoMeta area="prospeccao" competencia={mes} atual={resumo.fechadoNoMes} titulo="Meta de fechamentos do mês" />}

      <div className="barra-lista">
        <div className="alternar-visao" role="radiogroup" aria-label="Visualização">
          <button role="radio" aria-checked={visao === 'lista'} className={visao === 'lista' ? 'ativo' : ''} onClick={() => trocarVisao('lista')}>
            <Icone nome="checklist" tamanho={16} /> Lista
          </button>
          <button role="radio" aria-checked={visao === 'quadro'} className={visao === 'quadro' ? 'ativo' : ''} onClick={() => trocarVisao('quadro')}>
            <Icone nome="quadro" tamanho={16} /> Quadro
          </button>
        </div>
        <span className="espaco" />
        <label className="busca">
          <Icone nome="busca" tamanho={16} />
          <input placeholder="Buscar empresa, pessoa, serviço" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        {visao === 'lista' && (
          <>
            <select value={etapa} onChange={(e) => setEtapa(e.target.value)} aria-label="Etapa">
              <option value="">Todas as etapas</option>
              {Object.entries(ETAPAS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordenar">
              {Object.entries(ORDENACOES).map(([v, o]) => <option key={v} value={v}>{o.nome}</option>)}
            </select>
          </>
        )}
      </div>

      {visao === 'lista' && (
        <div className="filtros-status">
          {filtros.map((f) => (
            <button key={f.valor} className={`filtro ${filtro === f.valor ? 'ativo' : ''} ${f.alerta ? 'com-alerta' : ''}`} onClick={() => setFiltro(f.valor)}>
              {f.nome} <span>{f.qtd}</span>
            </button>
          ))}
        </div>
      )}

      {erro && <p className="alerta alerta-erro">{erro}</p>}

      {prospects === null ? (
        <p className="texto-suave">Carregando…</p>
      ) : prospects.length === 0 ? (
        <div className="cartao vazio">
          <p>Nenhum prospect ainda. Clique em “Novo prospect” para começar o pipeline.</p>
        </div>
      ) : visao === 'quadro' ? (
        <>
          <p className="texto-suave dica-campo">Arraste os cartões para mudar a etapa.</p>
          <Quadro
            prospects={[...buscados].sort(ORDENACOES.proximo.fn)}
            aoAbrir={(p) => navigate(p.id)}
            aoMover={(p, nova) => atualizar(p, { etapa: nova })}
          />
        </>
      ) : visiveis.length === 0 ? (
        <div className="cartao vazio">
          <p>{filtro === 'contatar' ? 'Ninguém para contatar hoje.' : 'Nenhum prospect com esses filtros.'}</p>
        </div>
      ) : (
        <div className="cartao tabela-rolagem">
          <table className="tabela tabela-prospects">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Etapa</th>
                <th>Temperatura</th>
                <th>Último contato</th>
                <th>Próximo contato</th>
                <th>Serviço pretendido</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
                <tr key={p.id} className="linha-clicavel" onClick={() => navigate(p.id)}>
                  <td data-rotulo="Empresa">
                    <strong>{p.empresa}</strong>
                    {(p.responsavel || p.contato) && (
                      <small className="texto-suave linha-detalhe">{[p.responsavel, p.contato].filter(Boolean).join(' · ')}</small>
                    )}
                  </td>
                  <td data-rotulo="Etapa" onClick={(e) => e.stopPropagation()}>
                    <select
                      className={`select-etapa etapa-${p.etapa}`}
                      value={p.etapa}
                      onChange={(e) => atualizar(p, { etapa: e.target.value })}
                      aria-label={`Etapa de ${p.empresa}`}
                    >
                      {Object.entries(ETAPAS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                  </td>
                  <td data-rotulo="Temperatura" onClick={(e) => e.stopPropagation()}>
                    <select
                      className={`select-status status-${p.status}`}
                      value={p.status}
                      onChange={(e) => atualizar(p, { status: e.target.value })}
                      aria-label={`Temperatura de ${p.empresa}`}
                    >
                      {Object.entries(STATUS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                  </td>
                  <td data-rotulo="Último contato">
                    {p.ultimo_contato
                      ? formatarData(p.ultimo_contato, { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : <span className="texto-suave">Nunca</span>}
                  </td>
                  <td data-rotulo="Próximo">{encerrado(p) ? <span className="texto-suave">—</span> : <ProximoContato prospect={p} />}</td>
                  <td data-rotulo="Serviço">{p.servico_pretendido || <span className="texto-suave">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {criando && <NovoProspect aoFechar={() => setCriando(false)} aoCriar={(p) => navigate(p.id)} />}
    </div>
  )
}
