import { useEffect, useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import { FORMAS_PAGAMENTO, formatarMoeda, lerMoeda, paraCampoMoeda } from '../../lib/moeda'
import { formatarData, hojeISO } from '../../lib/datas'
import Modal, { BotaoExcluir } from '../../components/Modal'
import Icone from '../../components/Icone'

const dataCompleta = { day: '2-digit', month: '2-digit', year: 'numeric' }

function ModalCompra({ prospectId, compra, produtoInicial, aoFechar, aoSalvar }) {
  const [form, setForm] = useState({
    produto: compra?.produto || produtoInicial || '',
    valor: paraCampoMoeda(compra?.valor),
    comprado_em: compra?.comprado_em || hojeISO(),
    forma_pagamento: compra?.forma_pagamento || '',
    data_pagamento: compra?.data_pagamento || '',
  })
  const [sugestoes, setSugestoes] = useState([])
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) })

  // Sugere o que já foi vendido e os produtos da Esteira (só aparecem para quem tem a Gestão liberada)
  useEffect(() => {
    Promise.all([
      supabase.from('prospect_compras').select('produto'),
      supabase.from('socorro_itens').select('titulo, socorro_categorias!inner(secao)')
        .eq('socorro_categorias.secao', 'gestao-esteira').eq('ativo', true),
    ]).then(([vendidos, esteira]) => {
      const nomes = [...(vendidos.data || []).map((c) => c.produto), ...(esteira.data || []).map((i) => i.titulo)]
      setSugestoes([...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR')))
    })
  }, [])

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    const valor = lerMoeda(form.valor)
    if (Number.isNaN(valor)) return setErro('Confira o valor: use números, como 1.500,00.')
    if (valor < 0) return setErro('O valor não pode ser negativo.')
    setSalvando(true)
    const dados = {
      produto: form.produto.trim(),
      valor,
      comprado_em: form.comprado_em,
      forma_pagamento: form.forma_pagamento || null,
      data_pagamento: form.data_pagamento || null,
    }
    const { error } = compra
      ? await supabase.from('prospect_compras').update(dados).eq('id', compra.id)
      : await supabase.from('prospect_compras').insert({ ...dados, prospect_id: prospectId })
    setSalvando(false)
    if (error) return setErro(traduzirErro(error))
    aoSalvar(compra ? 'Compra atualizada.' : 'Compra registrada.')
  }

  async function excluir() {
    const { error } = await supabase.from('prospect_compras').delete().eq('id', compra.id)
    if (error) return setErro(traduzirErro(error))
    aoSalvar('Compra excluída.')
  }

  return (
    <Modal
      titulo={compra ? 'Editar compra' : 'Nova compra'}
      aoFechar={aoFechar}
      largura={560}
      rodape={
        <>
          {compra && <BotaoExcluir aoConfirmar={excluir} texto="Excluir compra" />}
          <span className="espaco" />
          <button type="button" className="botao botao-secundario" onClick={aoFechar}>Cancelar</button>
          <button type="submit" form="form-compra" className="botao botao-principal" disabled={salvando || !form.produto.trim() || !form.comprado_em}>Salvar</button>
        </>
      }
    >
      <form id="form-compra" className="formulario" onSubmit={salvar}>
        <label className="campo">
          <span>Produto</span>
          <input {...campo('produto')} list="produtos-vendidos" placeholder="Landing page, consultoria…" required autoFocus />
          <datalist id="produtos-vendidos">
            {sugestoes.map((nome) => <option key={nome} value={nome} />)}
          </datalist>
        </label>
        <div className="grade-campos">
          <label className="campo">
            <span>Valor</span>
            <div className="campo-moeda"><span>R$</span><input inputMode="decimal" placeholder="0,00" {...campo('valor')} /></div>
          </label>
          <label className="campo"><span>Comprou em</span><input type="date" {...campo('comprado_em')} required /></label>
          <label className="campo">
            <span>Forma de pagamento</span>
            <select {...campo('forma_pagamento')}>
              <option value="">—</option>
              {Object.entries(FORMAS_PAGAMENTO).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </label>
          <label className="campo"><span>Data de pagamento</span><input type="date" {...campo('data_pagamento')} /></label>
        </div>
        <p className="texto-suave dica-campo">Sem cobrança? Deixe o valor vazio. O valor entra na meta do mês em que a compra foi feita.</p>
        {erro && <p className="alerta alerta-erro">{erro}</p>}
      </form>
    </Modal>
  )
}

export default function Compras({ prospect, compras, aoMudar }) {
  const [editando, setEditando] = useState(null)   // null | 'nova' | compra

  // A primeira compra já vem com o que estava anotado no cadastro
  const produtoInicial = compras.length ? '' : prospect.pos_venda_comprou || prospect.servico_pretendido || ''
  const total = compras.reduce((soma, c) => soma + Number(c.valor || 0), 0)

  return (
    <section className="cartao secao">
      <div className="linha-topo">
        <h2>Produtos comprados</h2>
        <button type="button" className="botao botao-secundario botao-pequeno" onClick={() => setEditando('nova')}>
          <Icone nome="mais" tamanho={16} /> Adicionar compra
        </button>
      </div>
      {compras.length === 0 ? (
        <p className="texto-suave">Nenhuma compra ainda. Registrar uma compra marca como fechado.</p>
      ) : (
        <ul className="lista-compras">
          {compras.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setEditando(c)}>
                <span>
                  <strong>{c.produto}</strong>
                  <small className="texto-suave linha-detalhe">
                    {[formatarData(c.comprado_em, dataCompleta), FORMAS_PAGAMENTO[c.forma_pagamento]].filter(Boolean).join(' · ')}
                  </small>
                </span>
                <span className="compra-valor">{c.valor != null ? formatarMoeda(c.valor) : <span className="texto-suave">Sem valor</span>}</span>
              </button>
            </li>
          ))}
          {compras.length > 1 && (
            <li className="compras-total"><span>Total</span><strong>{formatarMoeda(total)}</strong></li>
          )}
        </ul>
      )}
      {editando && (
        <ModalCompra
          prospectId={prospect.id}
          compra={editando === 'nova' ? null : editando}
          produtoInicial={produtoInicial}
          aoFechar={() => setEditando(null)}
          aoSalvar={(mensagem) => { setEditando(null); aoMudar(mensagem) }}
        />
      )}
    </section>
  )
}
