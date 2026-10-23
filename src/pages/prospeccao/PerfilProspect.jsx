import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { FORMAS_PAGAMENTO, formatarMoeda, lerMoeda, paraCampoMoeda } from '../../lib/moeda'
import { CORES_CLIENTE } from '../../lib/cores'
import Modal, { BotaoExcluir } from '../../components/Modal'
import Icone from '../../components/Icone'
import BotaoSalvar, { useSalvar } from '../../components/BotaoSalvar'
import { formatarData, hojeISO, paraISO } from '../../lib/datas'
import { CANAIS, ETAPAS, EscolhaStatus, ProximoContato, TrilhaEtapas, emPosVenda, encerrado, fechado as estaFechado } from './comum'
import { EscolhaMotivo, ModalPosVenda, RETOMAR_POS_VENDA, SeloMotivo, daquiAMeses } from './PosVenda'

const CAMPOS_TEXTO = ['empresa', 'responsavel', 'contato', 'servico_pretendido', 'data_pagamento', 'forma_pagamento', 'proximo_contato', 'proximo_passo',
  'pos_venda_motivo', 'pos_venda_comprou', 'pos_venda_desde']

function paraFormulario(p) {
  return {
    empresa: p.empresa || '',
    responsavel: p.responsavel || '',
    contato: p.contato || '',
    status: p.status,
    etapa: p.etapa,
    data_primeiro_contato: p.data_primeiro_contato || '',
    proximo_contato: p.proximo_contato || '',
    proximo_passo: p.proximo_passo || '',
    servico_pretendido: p.servico_pretendido || '',
    valor_estimado: paraCampoMoeda(p.valor_estimado),
    valor_fechado: paraCampoMoeda(p.valor_fechado),
    data_pagamento: p.data_pagamento || '',
    forma_pagamento: p.forma_pagamento || '',
    pos_venda_motivo: p.pos_venda_motivo || '',
    pos_venda_comprou: p.pos_venda_comprou || '',
    pos_venda_desde: p.pos_venda_desde || '',
  }
}

function Anotacoes({ prospectId, versao }) {
  const { session } = useAuth()
  const [lista, setLista] = useState(null)
  const [pessoas, setPessoas] = useState({})
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('prospect_anotacoes').select('*')
      .eq('prospect_id', prospectId).order('criado_em', { ascending: false })
    setLista(data || [])
  }, [prospectId])

  useEffect(() => { carregar() }, [carregar, versao])

  useEffect(() => {
    supabase.from('perfis').select('id, nome, email').then(({ data }) =>
      setPessoas(Object.fromEntries((data || []).map((p) => [p.id, p.nome || p.email]))))
  }, [carregar])

  async function adicionar(e) {
    e.preventDefault()
    if (!texto.trim()) return
    const { error } = await supabase.from('prospect_anotacoes').insert({ prospect_id: prospectId, texto: texto.trim() })
    if (error) return setErro(traduzirErro(error))
    setTexto('')
    carregar()
  }

  async function excluir(id) {
    const { error } = await supabase.from('prospect_anotacoes').delete().eq('id', id)
    if (error) return setErro(traduzirErro(error))
    carregar()
  }

  return (
    <section className="cartao secao">
      <h2>Histórico</h2>
      <form className="formulario" onSubmit={adicionar}>
        <textarea
          rows={3}
          placeholder="Como foi o contato, próximos passos, objeções…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && adicionar(e)}
        />
        <button className="botao botao-principal botao-pequeno alinhar-inicio" disabled={!texto.trim()}>Adicionar anotação</button>
      </form>
      {erro && <p className="alerta alerta-erro">{erro}</p>}
      {lista?.length === 0 && <p className="texto-suave">Nenhuma anotação ainda.</p>}
      <ol className="linha-do-tempo">
        {lista?.map((a) => (
          <li key={a.id} className={a.canal ? 'eh-contato' : ''}>
            <div className="linha-do-tempo-topo">
              {a.canal && <span className="etiqueta-contato">Contato · {CANAIS[a.canal]}</span>}
              <strong>{pessoas[a.autor_id] || 'Alguém da equipe'}</strong>
              <span className="texto-suave">
                {a.contato_em && a.contato_em !== paraISO(new Date(a.criado_em))
                  ? formatarData(a.contato_em, { day: '2-digit', month: 'short', year: 'numeric' })
                  : new Date(a.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              {a.autor_id === session.user.id && (
                <button className="botao-icone mini" onClick={() => excluir(a.id)} aria-label="Excluir anotação" title="Excluir">
                  <Icone nome="lixeira" tamanho={14} />
                </button>
              )}
            </div>
            <p>{a.texto}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function proximaEtapa(etapa) {
  const ordem = Object.keys(ETAPAS)
  return ['fechado', 'perdido', 'negociacao'].includes(etapa) ? etapa : ordem[ordem.indexOf(etapa) + 1]
}

function daquiA(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return paraISO(d)
}

function RegistrarContato({ prospect, aoFechar, aoRegistrar }) {
  const [form, setForm] = useState({
    canal: 'whatsapp',
    contato_em: hojeISO(),
    texto: '',
    etapa: prospect.etapa === 'a_contatar' ? 'primeiro_contato' : prospect.etapa,
    proximo_contato: '',
    proximo_passo: '',
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    const { error } = await supabase.from('prospect_anotacoes').insert({
      prospect_id: prospect.id,
      canal: form.canal,
      contato_em: form.contato_em,
      texto: form.texto.trim() || `Contato por ${CANAIS[form.canal]}.`,
    })
    if (error) { setSalvando(false); return setErro(traduzirErro(error)) }
    const encerra = !emPosVenda(prospect) && ['fechado', 'perdido'].includes(form.etapa)
    const { data, error: erro2 } = await supabase.from('prospects').update({
      etapa: form.etapa,
      proximo_contato: encerra ? null : form.proximo_contato || null,
      proximo_passo: encerra ? null : form.proximo_passo.trim() || null,
    }).eq('id', prospect.id).select('*, clientes(id, nome)').single()
    setSalvando(false)
    if (erro2) return setErro(traduzirErro(erro2))
    aoRegistrar(data)
  }

  const seguinte = proximaEtapa(form.etapa)
  // No Pós-venda a etapa não muda e o retorno costuma ser em meses
  const posVenda = emPosVenda(prospect)
  const atalhos = posVenda
    ? RETOMAR_POS_VENDA.map(([m, n]) => [daquiAMeses(m), n])
    : [[2, 'Em 2 dias'], [7, 'Em 1 semana'], [15, 'Em 15 dias'], [30, 'Em 1 mês']].map(([d, n]) => [daquiA(d), n])

  return (
    <Modal
      titulo={`Contato com ${prospect.empresa}`}
      aoFechar={aoFechar}
      largura={560}
      rodape={
        <>
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-contato" className="botao botao-principal" disabled={salvando || !form.contato_em}>Registrar</button>
        </>
      }
    >
      <form id="form-contato" className="formulario" onSubmit={salvar}>
        <div className="campo">
          <span>Por onde</span>
          <div className="filtros-status" role="radiogroup" aria-label="Canal">
            {Object.entries(CANAIS).map(([v, nome]) => (
              <button key={v} type="button" role="radio" aria-checked={form.canal === v}
                className={`filtro ${form.canal === v ? 'ativo' : ''}`}
                onClick={() => setForm({ ...form, canal: v })}>
                {nome}
              </button>
            ))}
          </div>
        </div>
        <div className="grade-campos">
          <label className="campo"><span>Quando</span><input type="date" {...campo('contato_em')} max={hojeISO()} required /></label>
          {!posVenda && <label className="campo">
            <span>Etapa depois deste contato</span>
            <select {...campo('etapa')}>
              {Object.entries(ETAPAS).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
            {seguinte !== form.etapa && (
              <button type="button" className="botao-link alinhar-inicio" onClick={() => setForm({ ...form, etapa: seguinte })}>
                Avançar para “{ETAPAS[seguinte]}”
              </button>
            )}
          </label>}
        </div>
        <a className="botao-link alinhar-inicio" href="#/comercial/roteiros" target="_blank" rel="noreferrer">
          Abrir os roteiros de mensagem (em outra aba)
        </a>
        <label className="campo">
          <span>Como foi</span>
          <textarea rows={3} placeholder="O que conversaram, objeções, interesse…" {...campo('texto')} />
        </label>
        {(posVenda || !['fechado', 'perdido'].includes(form.etapa)) && (
          <>
            <div className="grade-campos">
              <label className="campo"><span>Retomar em</span><input type="date" {...campo('proximo_contato')} min={hojeISO()} /></label>
              <label className="campo"><span>Próximo passo</span><input {...campo('proximo_passo')} placeholder="Mandar proposta, cobrar resposta…" /></label>
            </div>
            <div className="filtros-status">
              {atalhos.map(([data, n]) => (
                <button key={n} type="button" className={`filtro ${form.proximo_contato === data ? 'ativo' : ''}`} onClick={() => setForm({ ...form, proximo_contato: data })}>{n}</button>
              ))}
            </div>
          </>
        )}
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

export default function PerfilProspect() {
  const { prospectId } = useParams()
  const navigate = useNavigate()
  const { permissoes } = useAuth()
  const [prospect, setProspect] = useState(undefined)
  const [form, setForm] = useState(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [mandando, setMandando] = useState(false)
  const [versaoHistorico, setVersaoHistorico] = useState(0)
  const { estado: estadoSalvar, rodar } = useSalvar()

  useEffect(() => {
    supabase.from('prospects').select('*, clientes(id, nome)').eq('id', prospectId).maybeSingle().then(({ data }) => {
      setProspect(data)
      if (data) setForm(paraFormulario(data))
    })
  }, [prospectId])

  if (prospect === undefined) return <div className="pagina"><p className="texto-suave">Carregando…</p></div>
  if (prospect === null) {
    return (
      <div className="pagina">
        <div className="cartao vazio">
          <p>Prospect não encontrado.</p>
          <Link className="botao botao-secundario" to="/comercial">Voltar para o Comercial</Link>
        </div>
      </div>
    )
  }

  const campo = (nome) => ({ value: form[nome], onChange: (e) => { setForm({ ...form, [nome]: e.target.value }); setAviso('') } })
  const alterado = JSON.stringify(form) !== JSON.stringify(paraFormulario(prospect))

  function salvar(e) {
    e.preventDefault()
    rodar(gravar)
  }

  async function gravar() {
    setErro('')
    const valorEstimado = lerMoeda(form.valor_estimado)
    const valorFechado = lerMoeda(form.valor_fechado)
    if (Number.isNaN(valorEstimado) || Number.isNaN(valorFechado)) return setErro('Confira os valores: use números, como 1.500,00.')
    if (valorEstimado < 0 || valorFechado < 0) return setErro('Os valores não podem ser negativos.')

    const dados = {
      status: form.status,
      etapa: form.etapa,
      data_primeiro_contato: form.data_primeiro_contato || null,
      valor_estimado: valorEstimado,
      valor_fechado: valorFechado,
      ...Object.fromEntries(CAMPOS_TEXTO.map((k) => [k, form[k].trim() || null])),
    }
    const { data, error } = await supabase.from('prospects').update(dados).eq('id', prospect.id).select('*, clientes(id, nome)').single()
    if (error) return setErro(traduzirErro(error))
    setProspect(data)
    setForm(paraFormulario(data))
    setAviso('Alterações salvas.')
    return true
  }

  function contatoRegistrado(data) {
    const jornada = ['etapa', 'data_primeiro_contato', 'proximo_contato', 'proximo_passo']
    const novo = paraFormulario(data)
    setProspect(data)
    setForm((f) => ({ ...f, ...Object.fromEntries(jornada.map((k) => [k, novo[k]])) }))
    setRegistrando(false)
    setVersaoHistorico((v) => v + 1)
    setAviso('Contato registrado.')
  }

  async function virarCliente() {
    setErro('')
    const cor = CORES_CLIENTE[Math.floor(Math.random() * CORES_CLIENTE.length)]
    const { data: cliente, error } = await supabase.from('clientes').insert({ nome: prospect.empresa, cor }).select().single()
    if (error) return setErro(traduzirErro(error))
    const { data } = await supabase.from('prospects').update({ cliente_id: cliente.id }).eq('id', prospect.id).select('*, clientes(id, nome)').single()
    if (data) setProspect(data)
    setAviso(`Área do Cliente de ${cliente.nome} criada. O contrato já está em Gestão › Contratos.`)
  }

  function aplicar(data, mensagem) {
    setProspect(data)
    setForm(paraFormulario(data))
    setAviso(mensagem)
  }

  async function tirarDoPosVenda() {
    setErro('')
    const { data, error } = await supabase.from('prospects')
      .update({ pos_venda_motivo: null, pos_venda_desde: null, pos_venda_comprou: null, proximo_contato: null, proximo_passo: null })
      .eq('id', prospect.id).select('*, clientes(id, nome)').single()
    if (error) return setErro(traduzirErro(error))
    aplicar(data, 'Saiu do Pós-venda e voltou para o Pipeline.')
  }

  // Nova negociação: abre um prospect novo no Pipeline (este fica como histórico da compra anterior)
  async function voltouANegociar() {
    setErro('')
    const hoje = hojeISO()
    const { data: novo, error } = await supabase.from('prospects').insert({
      empresa: prospect.empresa,
      responsavel: prospect.responsavel,
      contato: prospect.contato,
      cliente_id: prospect.cliente_id,
      etapa: 'em_conversa',
      status: 'morno',
      data_primeiro_contato: hoje,
      ultimo_contato: hoje,
    }).select().single()
    if (error) return setErro(traduzirErro(error))
    await supabase.from('prospect_anotacoes').insert({
      prospect_id: novo.id,
      texto: `Voltou a negociar pelo Pós-venda (${prospect.pos_venda_comprou ? `já tinha comprado: ${prospect.pos_venda_comprou}` : 'cliente anterior'}).`,
    })
    await supabase.from('prospects')
      .update({ pos_venda_motivo: null, pos_venda_desde: null, pos_venda_comprou: null, proximo_contato: null, proximo_passo: null })
      .eq('id', prospect.id)
    navigate(`/comercial/${novo.id}`)
  }

  async function excluir() {
    const { error } = await supabase.from('prospects').delete().eq('id', prospect.id)
    if (error) return setErro(traduzirErro(error))
    navigate('/comercial')
  }

  const fechado = prospect.valor_fechado != null
  const posVenda = emPosVenda(prospect)

  return (
    <div className="pagina">
      {posVenda
        ? <Link to="/comercial/pos-venda" className="migalha"><Icone nome="voltar" tamanho={16} /> Pós-venda</Link>
        : <Link to="/comercial" className="migalha"><Icone nome="voltar" tamanho={16} /> Comercial</Link>}

      <header className="pagina-topo linha-topo">
        <div>
          <h1>{prospect.empresa}</h1>
          <p className="texto-suave">
            {[prospect.responsavel, posVenda ? prospect.pos_venda_comprou : prospect.servico_pretendido].filter(Boolean).join(' · ') || 'Prospect'}
          </p>
        </div>
        {posVenda
          ? <SeloMotivo motivo={prospect.pos_venda_motivo} />
          : fechado && <span className="selo-status status-fechado">Fechado · {formatarMoeda(prospect.valor_fechado)}</span>}
      </header>

      <form className="perfil-prospect" onSubmit={salvar}>
        {posVenda && (
          <section className="cartao secao">
            <div className="linha-topo">
              <h2>Pós-venda</h2>
              <button type="button" className="botao botao-principal botao-pequeno" onClick={() => setRegistrando(true)}>
                <Icone nome="comentario" tamanho={16} /> Registrei um contato
              </button>
            </div>
            <div className="campo">
              <span>Por que está aqui</span>
              <EscolhaMotivo valor={form.pos_venda_motivo} onChange={(pos_venda_motivo) => { setForm({ ...form, pos_venda_motivo }); setAviso('') }} />
            </div>
            <div className="grade-campos">
              <label className="campo"><span>O que comprou</span><input {...campo('pos_venda_comprou')} /></label>
              <label className="campo">
                <span>{form.pos_venda_motivo === 'contrato_encerrado' ? 'Encerrou em' : 'Comprou em'}</span>
                <input type="date" {...campo('pos_venda_desde')} />
              </label>
            </div>
            <div className="resumo-jornada">
              <div>
                <span className="texto-suave">Último contato</span>
                <strong>{prospect.ultimo_contato ? formatarData(prospect.ultimo_contato, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nunca'}</strong>
              </div>
              <div>
                <span className="texto-suave">Retomar em</span>
                <strong><ProximoContato prospect={prospect} comPasso={false} /></strong>
              </div>
            </div>
            <div className="grade-campos">
              <label className="campo"><span>Retomar o contato em</span><input type="date" {...campo('proximo_contato')} /></label>
              <label className="campo"><span>Próximo passo</span><input {...campo('proximo_passo')} placeholder="Oferecer gestão mensal…" /></label>
            </div>
            <div className="filtros-status">
              {RETOMAR_POS_VENDA.map(([m, n]) => (
                <button key={m} type="button" className={`filtro ${form.proximo_contato === daquiAMeses(m) ? 'ativo' : ''}`} onClick={() => { setForm({ ...form, proximo_contato: daquiAMeses(m) }); setAviso('') }}>{n}</button>
              ))}
            </div>
            <div className="botoes-pos-venda">
              <button type="button" className="botao botao-secundario botao-pequeno" onClick={voltouANegociar}>Voltou a negociar</button>
              <button type="button" className="botao botao-secundario botao-pequeno" onClick={tirarDoPosVenda}>Tirar do Pós-venda</button>
            </div>
            <p className="texto-suave dica-campo">“Voltou a negociar” abre uma negociação nova no Pipeline; este cadastro fica como histórico da compra anterior.</p>
          </section>
        )}

        {!posVenda && <section className="cartao secao">
          <div className="linha-topo">
            <h2>Jornada</h2>
            <button type="button" className="botao botao-principal botao-pequeno" onClick={() => setRegistrando(true)}>
              <Icone nome="comentario" tamanho={16} /> Registrei um contato
            </button>
          </div>
          <TrilhaEtapas valor={form.etapa} onChange={(etapa) => { setForm({ ...form, etapa }); setAviso('') }} />
          <div className="resumo-jornada">
            <div>
              <span className="texto-suave">Último contato</span>
              <strong>{prospect.ultimo_contato ? formatarData(prospect.ultimo_contato, { day: '2-digit', month: 'short', year: 'numeric' }) : 'Nunca'}</strong>
            </div>
            <div>
              <span className="texto-suave">Próximo contato</span>
              <strong>{encerrado(prospect) ? '—' : <ProximoContato prospect={prospect} comPasso={false} />}</strong>
            </div>
          </div>
          {!['fechado', 'perdido'].includes(form.etapa) && (
            <div className="grade-campos">
              <label className="campo"><span>Retomar em</span><input type="date" {...campo('proximo_contato')} /></label>
              <label className="campo"><span>Próximo passo</span><input {...campo('proximo_passo')} placeholder="Mandar proposta, cobrar resposta…" /></label>
            </div>
          )}
          <div className="campo">
            <span>Temperatura</span>
            <EscolhaStatus valor={form.status} onChange={(status) => setForm({ ...form, status })} />
          </div>
        </section>}

        <section className="cartao secao">
          <h2>Dados do prospect</h2>
          <div className="grade-campos">
            <label className="campo"><span>Nome da empresa</span><input {...campo('empresa')} required /></label>
            <label className="campo"><span>Nome do responsável</span><input {...campo('responsavel')} /></label>
            <label className="campo"><span>Contato</span><input {...campo('contato')} /></label>
            <label className="campo"><span>Data do primeiro contato</span><input type="date" {...campo('data_primeiro_contato')} /></label>
          </div>
          <label className="campo"><span>Serviço pretendido</span><input {...campo('servico_pretendido')} /></label>
        </section>

        <section className="cartao secao">
          <h2>Negociação</h2>
          <div className="grade-campos">
            <label className="campo">
              <span>Valor estimado</span>
              <div className="campo-moeda"><span>R$</span><input inputMode="decimal" placeholder="0,00" {...campo('valor_estimado')} /></div>
            </label>
            <label className="campo">
              <span>Valor fechado</span>
              <div className="campo-moeda"><span>R$</span><input inputMode="decimal" placeholder="0,00" {...campo('valor_fechado')} /></div>
            </label>
            <label className="campo"><span>Data de pagamento</span><input type="date" {...campo('data_pagamento')} /></label>
            <label className="campo">
              <span>Forma de pagamento</span>
              <select {...campo('forma_pagamento')}>
                <option value="">—</option>
                {Object.entries(FORMAS_PAGAMENTO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
              </select>
            </label>
          </div>
          <p className="texto-suave dica-campo">Preencher o valor fechado marca o prospect como fechado.</p>
        </section>

        <div className="barra-salvar">
          {erro && <p className="alerta alerta-erro">{erro}</p>}
          {aviso && <p className="alerta alerta-ok">{aviso}</p>}
          <span className="espaco" />
          {alterado && <span className="texto-suave">Alterações não salvas</span>}
          <BotaoSalvar estado={estadoSalvar} disabled={!alterado} />
        </div>
      </form>

      <Anotacoes prospectId={prospect.id} versao={versaoHistorico} />

      {registrando && <RegistrarContato prospect={prospect} aoFechar={() => setRegistrando(false)} aoRegistrar={contatoRegistrado} />}

      {!posVenda && estaFechado(prospect) && (
        <section className="cartao secao">
          <h2>Pós-venda</h2>
          <p className="texto-suave">Comprou só um produto ou encerrou o contrato? Mande para o Pós-venda para lembrar de retomar o contato depois de um tempo.</p>
          <button className="botao botao-secundario alinhar-inicio" onClick={() => setMandando(true)}>Mandar para o Pós-venda</button>
        </section>
      )}
      {mandando && (
        <ModalPosVenda
          prospect={prospect}
          aoFechar={() => setMandando(false)}
          aoSalvar={(data) => { setMandando(false); aplicar(data, 'Foi para o Pós-venda.') }}
        />
      )}

      <section className="cartao secao">
        <h2>Área do Cliente</h2>
        {prospect.clientes ? (
          <>
            <p className="texto-suave">Este prospect virou cliente.</p>
            <Link className="botao botao-secundario alinhar-inicio" to={`/clientes/${prospect.clientes.id}/configuracoes`}>
              Abrir {prospect.clientes.nome} <Icone nome="seta" tamanho={16} />
            </Link>
          </>
        ) : permissoes.admin ? (
          <>
            <p className="texto-suave">Fechou negócio? Crie a Área do Cliente com o nome desta empresa, pronta para Tarefas, Calendário e Bloco de Notas.</p>
            <button className="botao botao-secundario alinhar-inicio" onClick={virarCliente}>Virar cliente</button>
          </>
        ) : (
          <p className="texto-suave">Quando o negócio fechar, a administração pode criar a Área do Cliente por aqui.</p>
        )}
      </section>

      <div className="rodape-perigo">
        <BotaoExcluir aoConfirmar={excluir} texto="Excluir prospect" />
      </div>
    </div>
  )
}
