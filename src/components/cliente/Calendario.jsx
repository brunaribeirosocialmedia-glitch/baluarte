import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, traduzirErro } from '../../lib/supabase'
import { useTempoReal } from '../../lib/useTempoReal'
import { useCliente } from '../../pages/AreaCliente'
import { formatarHora, hojeISO, paraCampoDataHora, paraISO, semanasDoMes, situacaoTarefa } from '../../lib/datas'
import LegendaTarefas from '../LegendaTarefas'
import BotaoSalvar, { pausaParaVer, useSalvar } from '../BotaoSalvar'
import { TIPOS_EVENTO } from '../../lib/cores'
import Modal, { BotaoExcluir } from '../Modal'
import Icone from '../Icone'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// No item novo, escolhe se é tarefa (vai para o quadro) ou evento (só no calendário)
function EscolherTipo({ tipo, aoTrocar }) {
  return (
    <div className="campo">
      <span>Criar</span>
      <div className="status-tarefa" role="radiogroup" aria-label="Tipo do item">
        {[['tarefa', 'Tarefa'], ['evento', 'Evento']].map(([v, n]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={tipo === v}
            className={`status-opcao ${tipo === v ? 'marcado' : ''}`}
            onClick={() => aoTrocar(v)}
          >
            {tipo === v && <Icone nome="confirmar" tamanho={15} />}
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function NovaTarefaModal({ diaInicial, clienteId, colunas, pessoas, aoTrocarTipo, aoFechar, aoMudar }) {
  const colunaPadrao = colunas.find((c) => !c.marca_concluida) || colunas[0]
  const [form, setForm] = useState({ titulo: '', coluna_id: colunaPadrao?.id || '', responsavel_id: '', prazo: diaInicial })
  const [erro, setErro] = useState('')
  const { estado: estadoSalvar, rodar } = useSalvar()
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  async function salvar(e) {
    e.preventDefault()
    if (!form.coluna_id) return setErro('Este cliente ainda não tem colunas no quadro de tarefas.')
    setErro('')
    const ok = await rodar(async () => {
      // entra no fim da coluna escolhida, como no quadro
      const { data: ultima } = await supabase.from('tarefas').select('ordem')
        .eq('coluna_id', form.coluna_id).order('ordem', { ascending: false }).limit(1).maybeSingle()
      const { error } = await supabase.from('tarefas').insert({
        cliente_id: clienteId,
        coluna_id: form.coluna_id,
        titulo: form.titulo.trim(),
        responsavel_id: form.responsavel_id || null,
        prazo: form.prazo || null,
        ordem: (ultima?.ordem ?? 0) + 1024,
      })
      if (error) return setErro(traduzirErro(error))
      aoMudar()
      return true
    })
    if (ok) {
      await pausaParaVer()
      aoFechar()
    }
  }

  return (
    <Modal
      titulo="Nova tarefa"
      aoFechar={aoFechar}
      largura={520}
      rodape={
        <>
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <BotaoSalvar type="submit" form="form-nova-tarefa" estado={estadoSalvar} disabled={!form.titulo.trim()} />
        </>
      }
    >
      <form id="form-nova-tarefa" className="formulario" onSubmit={salvar}>
        <EscolherTipo tipo="tarefa" aoTrocar={aoTrocarTipo} />
        <label className="campo">
          <span>Título</span>
          <input {...campo('titulo')} required autoFocus />
        </label>
        <div className="grade-campos">
          <label className="campo">
            <span>Prazo</span>
            <input type="date" {...campo('prazo')} required />
          </label>
          <label className="campo">
            <span>Responsável</span>
            <select {...campo('responsavel_id')}>
              <option value="">Ninguém</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome || p.email}</option>)}
            </select>
          </label>
        </div>
        <label className="campo">
          <span>Coluna no quadro</span>
          <select {...campo('coluna_id')}>
            {colunas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <p className="dica-calendario">Ela entra no quadro de Tarefas. Descrição, checklist e o resto você completa abrindo a tarefa.</p>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

function EventoModal({ evento, diaInicial, clienteId, aoTrocarTipo, aoFechar, aoMudar }) {
  const novo = !evento.id
  const [form, setForm] = useState(() => ({
    titulo: evento.titulo || '',
    tipo: evento.tipo || 'reuniao',
    dia_inteiro: evento.dia_inteiro ?? false,
    dia: evento.inicio ? paraISO(new Date(evento.inicio)) : diaInicial,
    inicio: evento.inicio ? paraCampoDataHora(evento.inicio) : `${diaInicial}T10:00`,
    fim: evento.fim ? paraCampoDataHora(evento.fim) : '',
    descricao: evento.descricao || '',
  }))
  const [erro, setErro] = useState('')
  const { estado: estadoSalvar, rodar } = useSalvar()
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  async function salvar(e) {
    e.preventDefault()
    const [a, m, d] = form.dia.split('-').map(Number)
    const inicio = form.dia_inteiro ? new Date(a, m - 1, d) : new Date(form.inicio)
    const fim = !form.dia_inteiro && form.fim ? new Date(form.fim) : null
    if (fim && fim < inicio) return setErro('O fim precisa ser depois do início.')
    const campos = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      dia_inteiro: form.dia_inteiro,
      inicio: inicio.toISOString(),
      fim: fim?.toISOString() || null,
      descricao: form.descricao.trim() || null,
    }
    setErro('')
    const ok = await rodar(async () => {
      const { error } = novo
        ? await supabase.from('eventos').insert({ ...campos, cliente_id: clienteId })
        : await supabase.from('eventos').update(campos).eq('id', evento.id)
      if (error) return setErro(traduzirErro(error))
      aoMudar()
      return true
    })
    if (ok) {
      await pausaParaVer()
      aoFechar()
    }
  }

  async function excluir() {
    const { error } = await supabase.from('eventos').delete().eq('id', evento.id)
    if (error) return setErro(traduzirErro(error))
    aoMudar()
    aoFechar()
  }

  return (
    <Modal
      titulo={novo ? 'Novo evento' : 'Evento'}
      aoFechar={aoFechar}
      largura={520}
      rodape={
        <>
          {!novo && <BotaoExcluir aoConfirmar={excluir} texto="Excluir evento" />}
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <BotaoSalvar type="submit" form="form-evento" estado={estadoSalvar} disabled={!form.titulo.trim()} />
        </>
      }
    >
      <form id="form-evento" className="formulario" onSubmit={salvar}>
        {novo && <EscolherTipo tipo="evento" aoTrocar={aoTrocarTipo} />}
        <label className="campo">
          <span>Título</span>
          <input {...campo('titulo')} required autoFocus />
        </label>
        <div className="grade-campos">
          <label className="campo">
            <span>Tipo</span>
            <select {...campo('tipo')}>
              {Object.entries(TIPOS_EVENTO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
          <label className="marcar marcar-campo">
            <input type="checkbox" checked={form.dia_inteiro} onChange={(e) => setForm({ ...form, dia_inteiro: e.target.checked })} />
            Dia inteiro
          </label>
        </div>
        {form.dia_inteiro ? (
          <label className="campo">
            <span>Data</span>
            <input type="date" {...campo('dia')} required />
          </label>
        ) : (
          <div className="grade-campos">
            <label className="campo">
              <span>Início</span>
              <input type="datetime-local" {...campo('inicio')} required />
            </label>
            <label className="campo">
              <span>Fim (opcional)</span>
              <input type="datetime-local" {...campo('fim')} />
            </label>
          </div>
        )}
        <label className="campo">
          <span>Descrição</span>
          <textarea rows={3} {...campo('descricao')} />
        </label>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

export default function Calendario() {
  const { cliente, pessoas } = useCliente()
  const navigate = useNavigate()
  const hoje = new Date()
  const [mes, setMes] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() })
  const [eventos, setEventos] = useState([])
  const [tarefas, setTarefas] = useState([])
  const [colunas, setColunas] = useState([])
  const [modal, setModal] = useState(null) // { tipo: 'tarefa' | 'evento', evento, dia }

  const semanas = useMemo(() => semanasDoMes(mes.ano, mes.mes), [mes])
  const primeiroDia = paraISO(semanas[0][0])
  const ultimoDia = paraISO(semanas.at(-1)[6])

  const carregar = useCallback(async () => {
    const inicio = new Date(semanas[0][0])
    const fim = new Date(semanas.at(-1)[6])
    fim.setDate(fim.getDate() + 1)
    const [{ data: ev }, { data: ta }, { data: co }] = await Promise.all([
      supabase.from('eventos').select('*').eq('cliente_id', cliente.id)
        .gte('inicio', inicio.toISOString()).lt('inicio', fim.toISOString()).order('inicio'),
      supabase.from('tarefas').select('id, titulo, prazo, concluida_em').eq('cliente_id', cliente.id)
        .gte('prazo', primeiroDia).lte('prazo', ultimoDia),
      supabase.from('tarefa_colunas').select('id, nome, marca_concluida').eq('cliente_id', cliente.id).order('ordem'),
    ])
    setEventos(ev || [])
    setTarefas(ta || [])
    setColunas(co || [])
  }, [cliente.id, semanas, primeiroDia, ultimoDia])

  useEffect(() => { carregar() }, [carregar])
  useTempoReal(['eventos', 'tarefas', 'tarefa_colunas'], cliente.id, carregar)

  // agrupa tudo por dia (AAAA-MM-DD, horário local)
  const porDia = useMemo(() => {
    const mapa = {}
    const add = (dia, item) => (mapa[dia] ||= []).push(item)
    eventos.forEach((e) => add(paraISO(new Date(e.inicio)), { ...e, origem: 'evento' }))
    tarefas.forEach((t) => add(t.prazo, { ...t, origem: 'tarefa' }))
    Object.values(mapa).forEach((lista) => lista.sort((a, b) =>
      (a.origem === 'evento' && !a.dia_inteiro ? new Date(a.inicio).getHours() * 60 + new Date(a.inicio).getMinutes() : -1) -
      (b.origem === 'evento' && !b.dia_inteiro ? new Date(b.inicio).getHours() * 60 + new Date(b.inicio).getMinutes() : -1)))
    return mapa
  }, [eventos, tarefas])

  const mudarMes = (delta) => setMes(({ ano, mes: m }) => {
    const d = new Date(ano, m + delta, 1)
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })

  const titulo = new Date(mes.ano, mes.mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const hojeTexto = hojeISO()

  function abrirItem(item) {
    if (item.origem === 'tarefa') navigate(`../tarefas?tarefa=${item.id}`)
    else setModal({ tipo: 'evento', evento: item })
  }
  // clicar num dia cria uma tarefa (dá para trocar para evento dentro da janela)
  const novoItem = (dia, tipo = 'tarefa') => setModal({ tipo, evento: {}, dia })

  return (
    <div className="calendario">
      <div className="barra-ferramentas">
        <div className="navegacao-mes">
          <button className="botao-icone" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="voltar" /></button>
          <h2>{titulo}</h2>
          <button className="botao-icone" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="avancar" /></button>
          <button className="botao botao-secundario botao-pequeno" onClick={() => setMes({ ano: hoje.getFullYear(), mes: hoje.getMonth() })}>
            Hoje
          </button>
        </div>
        <span className="espaco" />
        <LegendaTarefas />
        <button className="botao botao-secundario botao-pequeno" onClick={() => novoItem(hojeTexto, 'evento')}>
          <Icone nome="mais" tamanho={16} /> Evento
        </button>
        <button className="botao botao-principal botao-pequeno" onClick={() => novoItem(hojeTexto, 'tarefa')}>
          <Icone nome="mais" tamanho={16} /> Tarefa
        </button>
      </div>

      <div className="grade-mes-rolagem">
        <div className="grade-mes">
          {DIAS_SEMANA.map((d) => <div key={d} className="dia-semana">{d}</div>)}
          {semanas.flat().map((data) => {
            const iso = paraISO(data)
            const itens = porDia[iso] || []
            const foraDoMes = data.getMonth() !== mes.mes
            return (
              <div
                key={iso}
                className={`dia ${foraDoMes ? 'fora' : ''} ${iso === hojeTexto ? 'hoje' : ''}`}
                onClick={(e) => e.target === e.currentTarget && novoItem(iso)}
              >
                <button className="dia-numero" onClick={() => novoItem(iso)} title="Criar tarefa ou evento neste dia">
                  {data.getDate()}
                </button>
                {itens.map((item) => (
                  <button
                    key={item.origem + item.id}
                    className={`item-agenda item-${item.origem} ${item.origem === 'tarefa' ? `tarefa-${situacaoTarefa(iso, item.concluida_em)}` : ''}`}
                    onClick={() => abrirItem(item)}
                    title={item.titulo}
                  >
                    {item.origem === 'evento' && !item.dia_inteiro && <b>{formatarHora(item.inicio)}</b>}
                    {item.titulo}
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {modal?.tipo === 'tarefa' && (
        <NovaTarefaModal
          diaInicial={modal.dia}
          clienteId={cliente.id}
          colunas={colunas}
          pessoas={pessoas}
          aoTrocarTipo={(tipo) => setModal({ ...modal, tipo })}
          aoFechar={() => setModal(null)}
          aoMudar={carregar}
        />
      )}
      {modal?.tipo === 'evento' && (
        <EventoModal
          evento={modal.evento}
          diaInicial={modal.dia}
          clienteId={cliente.id}
          aoTrocarTipo={(tipo) => setModal({ ...modal, tipo })}
          aoFechar={() => setModal(null)}
          aoMudar={carregar}
        />
      )}
    </div>
  )
}
