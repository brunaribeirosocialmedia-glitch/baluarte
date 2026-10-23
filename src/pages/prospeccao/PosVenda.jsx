import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { formatarData, hojeISO, paraISO } from '../../lib/datas'
import Modal from '../../components/Modal'
import Icone from '../../components/Icone'
import { AbasProspeccao, MOTIVOS_POS_VENDA, ProximoContato, emPosVenda, fechado, precisaContatar } from './comum'

export function daquiAMeses(meses) {
  const d = new Date()
  d.setMonth(d.getMonth() + meses)
  return paraISO(d)
}

export const RETOMAR_POS_VENDA = [[1, 'Em 1 mês'], [3, 'Em 3 meses'], [6, 'Em 6 meses'], [12, 'Em 1 ano']]

export function SeloMotivo({ motivo }) {
  return <span className={`selo-status motivo-${motivo}`}>{MOTIVOS_POS_VENDA[motivo]}</span>
}

// Botões "Comprou só um produto" / "Encerrou o contrato"
export function EscolhaMotivo({ valor, onChange }) {
  return (
    <div className="escolha-status" role="radiogroup" aria-label="Motivo">
      {Object.entries(MOTIVOS_POS_VENDA).map(([v, nome]) => (
        <button key={v} type="button" role="radio" aria-checked={valor === v}
          className={`selo-status motivo-${v} ${valor === v ? 'marcado' : ''}`}
          onClick={() => onChange(v)}>
          {nome}
        </button>
      ))}
    </div>
  )
}

// Manda alguém para o Pós-venda: um prospect que já existe (do perfil ou escolhido
// da lista do Pipeline) ou alguém cadastrado do zero
export function ModalPosVenda({ prospect, aoFechar, aoSalvar }) {
  const [origem, setOrigem] = useState(prospect ? 'pipeline' : 'novo')
  const [pipeline, setPipeline] = useState(null)
  const [form, setForm] = useState({
    prospect_id: prospect?.id || '',
    empresa: '', responsavel: '', contato: '',
    pos_venda_motivo: 'um_produto',
    pos_venda_comprou: prospect?.servico_pretendido || '',
    pos_venda_desde: hojeISO(),
    proximo_contato: daquiAMeses(3),
    proximo_passo: '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  useEffect(() => {
    if (prospect || origem !== 'pipeline' || pipeline) return
    supabase.from('prospects').select('id, empresa, etapa, valor_fechado, servico_pretendido, pos_venda_motivo').order('empresa')
      .then(({ data }) => {
        const lista = (data || []).filter((p) => !emPosVenda(p))
        // fechados primeiro: são os que mais costumam vir para cá
        setPipeline([...lista.filter(fechado), ...lista.filter((p) => !fechado(p))])
      })
  }, [prospect, origem, pipeline])

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    const dados = {
      pos_venda_motivo: form.pos_venda_motivo,
      pos_venda_comprou: form.pos_venda_comprou.trim() || null,
      pos_venda_desde: form.pos_venda_desde || null,
      proximo_contato: form.proximo_contato || null,
      proximo_passo: form.proximo_passo.trim() || null,
    }
    const consulta = origem === 'novo'
      ? supabase.from('prospects').insert({
        ...dados,
        empresa: form.empresa.trim(),
        responsavel: form.responsavel.trim() || null,
        contato: form.contato.trim() || null,
        etapa: 'fechado',
      })
      : supabase.from('prospects').update(dados).eq('id', form.prospect_id)
    const { data, error } = await consulta.select('*, clientes(id, nome)').single()
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    aoSalvar(data)
  }

  const pronto = origem === 'novo' ? form.empresa.trim() : form.prospect_id

  return (
    <Modal
      titulo={prospect ? `Mandar ${prospect.empresa} para o Pós-venda` : 'Adicionar ao Pós-venda'}
      aoFechar={aoFechar}
      largura={560}
      rodape={
        <>
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-pos-venda" className="botao botao-principal" disabled={!pronto || salvando}>
            {prospect ? 'Mandar' : 'Adicionar'}
          </button>
        </>
      }
    >
      <form id="form-pos-venda" className="formulario" onSubmit={salvar}>
        {!prospect && (
          <div className="filtros-status" role="radiogroup" aria-label="Quem">
            <button type="button" role="radio" aria-checked={origem === 'novo'} className={`filtro ${origem === 'novo' ? 'ativo' : ''}`} onClick={() => setOrigem('novo')}>
              Cadastrar alguém novo
            </button>
            <button type="button" role="radio" aria-checked={origem === 'pipeline'} className={`filtro ${origem === 'pipeline' ? 'ativo' : ''}`} onClick={() => setOrigem('pipeline')}>
              Trazer do Pipeline
            </button>
          </div>
        )}

        {!prospect && origem === 'pipeline' && (
          <label className="campo">
            <span>Quem</span>
            <select
              value={form.prospect_id}
              onChange={(e) => {
                const p = pipeline.find((x) => x.id === e.target.value)
                setForm({ ...form, prospect_id: e.target.value, pos_venda_comprou: form.pos_venda_comprou || p?.servico_pretendido || '' })
              }}
              required
            >
              <option value="">{pipeline ? 'Escolha…' : 'Carregando…'}</option>
              {pipeline?.map((p) => <option key={p.id} value={p.id}>{p.empresa}{fechado(p) ? ' · fechado' : ''}</option>)}
            </select>
          </label>
        )}

        {origem === 'novo' && (
          <>
            <label className="campo">
              <span>Nome (empresa ou pessoa)</span>
              <input {...campo('empresa')} required autoFocus />
            </label>
            <div className="grade-campos">
              <label className="campo"><span>Nome do responsável</span><input {...campo('responsavel')} /></label>
              <label className="campo"><span>Contato</span><input {...campo('contato')} placeholder="WhatsApp, e-mail, @instagram" /></label>
            </div>
          </>
        )}

        <div className="campo">
          <span>Por que está aqui</span>
          <EscolhaMotivo valor={form.pos_venda_motivo} onChange={(pos_venda_motivo) => setForm({ ...form, pos_venda_motivo })} />
        </div>
        <div className="grade-campos">
          <label className="campo">
            <span>O que comprou</span>
            <input {...campo('pos_venda_comprou')} placeholder="Análise de perfil, pacote de reels…" />
          </label>
          <label className="campo">
            <span>{form.pos_venda_motivo === 'contrato_encerrado' ? 'Encerrou em' : 'Comprou em'}</span>
            <input type="date" {...campo('pos_venda_desde')} />
          </label>
          <label className="campo"><span>Retomar o contato em</span><input type="date" {...campo('proximo_contato')} /></label>
          <label className="campo"><span>Próximo passo</span><input {...campo('proximo_passo')} placeholder="Oferecer gestão mensal…" /></label>
        </div>
        <div className="filtros-status">
          {RETOMAR_POS_VENDA.map(([m, n]) => (
            <button key={m} type="button" className={`filtro ${form.proximo_contato === daquiAMeses(m) ? 'ativo' : ''}`} onClick={() => setForm({ ...form, proximo_contato: daquiAMeses(m) })}>{n}</button>
          ))}
        </div>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

export default function PosVenda() {
  const navigate = useNavigate()
  const [lista, setLista] = useState(null)
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('')   // '' | contatar | um_produto | contrato_encerrado
  const [busca, setBusca] = useState('')
  const [criando, setCriando] = useState(false)

  useEffect(() => {
    supabase.from('prospects').select('*').not('pos_venda_motivo', 'is', null).then(({ data, error }) => {
      if (error) setErro(traduzirErro(error))
      setLista(data || [])
    })
  }, [])

  const buscados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return (lista || []).filter((p) => !termo || [p.empresa, p.responsavel, p.contato, p.pos_venda_comprou, p.proximo_passo]
      .some((x) => (x || '').toLowerCase().includes(termo)))
  }, [lista, busca])

  const visiveis = useMemo(() => buscados
    .filter((p) => (filtro === 'contatar' ? precisaContatar(p) : !filtro || p.pos_venda_motivo === filtro))
    .sort((a, b) => {
      if (!a.proximo_contato || !b.proximo_contato) return (a.proximo_contato ? -1 : 0) + (b.proximo_contato ? 1 : 0)
      return a.proximo_contato.localeCompare(b.proximo_contato)
    }), [buscados, filtro])

  const contatar = (lista || []).filter(precisaContatar).length
  const filtros = [
    { valor: '', nome: 'Todos', qtd: (lista || []).length },
    { valor: 'contatar', nome: 'Preciso contatar', qtd: contatar, alerta: contatar > 0 },
    ...Object.entries(MOTIVOS_POS_VENDA).map(([v, nome]) => ({ valor: v, nome, qtd: (lista || []).filter((p) => p.pos_venda_motivo === v).length })),
  ]

  return (
    <div className="pagina pagina-larga">
      <AbasProspeccao />
      <header className="pagina-topo linha-topo">
        <div>
          <h1>Pós-venda</h1>
          <p className="texto-suave">Quem comprou só um produto ou encerrou o contrato, para retomar o contato depois de um tempo.</p>
        </div>
        <button className="botao botao-principal" onClick={() => setCriando(true)}>
          <Icone nome="mais" tamanho={18} /> Adicionar
        </button>
      </header>

      <div className="barra-lista">
        <div className="filtros-status">
          {filtros.map((f) => (
            <button key={f.valor} className={`filtro ${filtro === f.valor ? 'ativo' : ''} ${f.alerta ? 'com-alerta' : ''}`} onClick={() => setFiltro(f.valor)}>
              {f.nome} <span>{f.qtd}</span>
            </button>
          ))}
        </div>
        <span className="espaco" />
        <label className="busca">
          <Icone nome="busca" tamanho={16} />
          <input placeholder="Buscar nome, produto, próximo passo" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>

      {erro && <p className="alerta alerta-erro">{erro}</p>}

      {lista === null ? (
        <p className="texto-suave">Carregando…</p>
      ) : lista.length === 0 ? (
        <div className="cartao vazio">
          <p>Ninguém no Pós-venda ainda. Clique em “Adicionar” ou, no perfil de um prospect fechado, em “Mandar para o Pós-venda”.</p>
        </div>
      ) : visiveis.length === 0 ? (
        <div className="cartao vazio">
          <p>{filtro === 'contatar' ? 'Ninguém para retomar hoje.' : 'Ninguém com esses filtros.'}</p>
        </div>
      ) : (
        <div className="cartao tabela-rolagem">
          <table className="tabela tabela-prospects">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Motivo</th>
                <th>O que comprou</th>
                <th>Desde</th>
                <th>Último contato</th>
                <th>Retomar em</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
                <tr key={p.id} className="linha-clicavel" onClick={() => navigate(`/comercial/${p.id}`)}>
                  <td data-rotulo="Nome">
                    <strong>{p.empresa}</strong>
                    {(p.responsavel || p.contato) && (
                      <small className="texto-suave linha-detalhe">{[p.responsavel, p.contato].filter(Boolean).join(' · ')}</small>
                    )}
                  </td>
                  <td data-rotulo="Motivo"><SeloMotivo motivo={p.pos_venda_motivo} /></td>
                  <td data-rotulo="Comprou">{p.pos_venda_comprou || <span className="texto-suave">—</span>}</td>
                  <td data-rotulo="Desde">
                    {p.pos_venda_desde ? formatarData(p.pos_venda_desde, { day: '2-digit', month: '2-digit', year: 'numeric' }) : <span className="texto-suave">—</span>}
                  </td>
                  <td data-rotulo="Último contato">
                    {p.ultimo_contato
                      ? formatarData(p.ultimo_contato, { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : <span className="texto-suave">Nunca</span>}
                  </td>
                  <td data-rotulo="Retomar em"><ProximoContato prospect={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {criando && <ModalPosVenda aoFechar={() => setCriando(false)} aoSalvar={(p) => navigate(`/comercial/${p.id}`)} />}
    </div>
  )
}
