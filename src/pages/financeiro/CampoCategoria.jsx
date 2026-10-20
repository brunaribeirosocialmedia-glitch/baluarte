import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, traduzirErro } from '../../lib/supabase'
import Icone from '../../components/Icone'

const chave = (nome) => (nome || '').trim().toLowerCase()

// Lista de categorias guardada no banco (criar, renomear e excluir pela tela)
function useCategorias(tabela) {
  const [lista, setLista] = useState([])
  const carregar = useCallback(async () => {
    const { data } = await supabase.from(tabela).select('*').order('nome')
    setLista(data || [])
  }, [tabela])
  useEffect(() => { carregar() }, [carregar])
  return { lista, carregar }
}

function EditarCategoria({ tabela, categoria, extra, aoVoltar, aoMudar }) {
  const [nome, setNome] = useState(categoria.nome)
  const [marcado, setMarcado] = useState(Boolean(extra && categoria[extra.chave]))
  const [erro, setErro] = useState('')
  const [confirmando, setConfirmando] = useState(false)

  async function salvar() {
    const { error } = await supabase.from(tabela).update({ nome: nome.trim(), ...(extra ? { [extra.chave]: marcado } : {}) }).eq('id', categoria.id)
    if (error) return setErro(error.code === '23505' ? 'Já existe uma categoria com esse nome.' : traduzirErro(error))
    await aoMudar({ antigo: categoria.nome, novo: nome.trim() })
    aoVoltar()
  }

  async function excluir() {
    const { error } = await supabase.from(tabela).delete().eq('id', categoria.id)
    if (error) return setErro(traduzirErro(error))
    await aoMudar({ antigo: categoria.nome, novo: null })
    aoVoltar()
  }

  return (
    <div className="editar-etiqueta">
      <label className="campo">
        <span>Nome</span>
        <input value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} autoFocus />
      </label>
      {extra && (
        <label className="marcar"><input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} /> {extra.rotulo}</label>
      )}
      <p className="texto-suave aviso-etiqueta">Renomear muda todos os lançamentos com esta categoria. Excluir tira da lista; os lançamentos antigos continuam com o nome.</p>
      {erro && <p className="alerta alerta-erro">{erro}</p>}
      <div className="editar-etiqueta-acoes">
        {confirmando ? (
          <>
            <button type="button" className="botao botao-perigo botao-pequeno" onClick={excluir}>Excluir de vez</button>
            <button type="button" className="botao-link" onClick={() => setConfirmando(false)}>Não</button>
          </>
        ) : (
          <button type="button" className="botao-link perigo" onClick={() => setConfirmando(true)}>Excluir categoria</button>
        )}
        <span className="espaco" />
        <button type="button" className="botao botao-secundario botao-pequeno" onClick={aoVoltar}>Voltar</button>
        <button type="button" className="botao botao-principal botao-pequeno" onClick={salvar} disabled={!nome.trim()}>Salvar</button>
      </div>
    </div>
  )
}

// Escolhe uma categoria da lista, cria nova na hora e edita/exclui as existentes
export default function CampoCategoria({ tabela, valor, onChange, extra }) {
  const { lista, carregar } = useCategorias(tabela)
  const [aberto, setAberto] = useState(false)
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState(null)
  const [erro, setErro] = useState('')
  const [marcarNova, setMarcarNova] = useState(false)
  const caixa = useRef(null)

  // fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const fora = (e) => { if (!caixa.current?.contains(e.target)) { setAberto(false); setEditando(null) } }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const termo = chave(texto)
  const visiveis = lista.filter((c) => !termo || chave(c.nome).includes(termo))
  const existente = lista.find((c) => chave(c.nome) === termo)
  const foraDaLista = valor && !lista.some((c) => chave(c.nome) === chave(valor))

  function escolher(nome) {
    onChange(nome)
    setAberto(false)
    setTexto('')
  }

  async function criar() {
    setErro('')
    const { data, error } = await supabase.from(tabela).insert({ nome: texto.trim(), ...(extra ? { [extra.chave]: marcarNova } : {}) }).select().single()
    if (error) return setErro(error.code === '23505' ? 'Já existe uma categoria com esse nome.' : traduzirErro(error))
    await carregar()
    setMarcarNova(false)
    escolher(data.nome)
  }

  // renomear: o banco atualiza os lançamentos; aqui ajustamos o formulário aberto
  async function aoEditar({ antigo, novo }) {
    if (chave(valor) === chave(antigo)) onChange(novo || '')
    await carregar()
  }

  return (
    <div className="seletor-etiquetas" ref={caixa}>
      <button type="button" className="campo-categoria" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        <span className={valor ? '' : 'texto-suave'}>{valor || 'Escolher categoria'}</span>
        {foraDaLista && <small className="texto-suave"> (fora da lista)</small>}
      </button>

      {aberto && (
        <div className="painel-etiquetas cartao">
          {editando ? (
            <EditarCategoria tabela={tabela} categoria={editando} extra={extra} aoVoltar={() => setEditando(null)} aoMudar={aoEditar} />
          ) : (
            <>
              <input
                placeholder="Buscar ou criar categoria"
                value={texto}
                maxLength={40}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (existente) escolher(existente.nome)
                  else if (termo) criar()
                }}
                autoFocus
              />
              <ul className="lista-etiquetas">
                {valor && (
                  <li>
                    <button type="button" className="opcao-etiqueta" onClick={() => escolher('')}>
                      <span className="marca-etiqueta" /> <span className="texto-suave">Sem categoria</span>
                    </button>
                  </li>
                )}
                {visiveis.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="opcao-etiqueta" onClick={() => escolher(c.nome)} aria-pressed={chave(c.nome) === chave(valor)}>
                      <span className="marca-etiqueta">{chave(c.nome) === chave(valor) && <Icone nome="confirmar" tamanho={14} />}</span>
                      {c.nome}
                      {extra && c[extra.chave] && <small className="texto-suave"> · {extra.curto}</small>}
                    </button>
                    <button type="button" className="botao-icone mini" onClick={() => setEditando(c)} title="Renomear ou excluir" aria-label={`Renomear ou excluir ${c.nome}`}>
                      <Icone nome="config" tamanho={15} />
                    </button>
                  </li>
                ))}
                {visiveis.length === 0 && !termo && <li className="texto-suave">Nenhuma categoria ainda. Digite um nome para criar.</li>}
              </ul>
              {termo && !existente && (
                <div className="criar-etiqueta">
                  {extra && <label className="marcar"><input type="checkbox" checked={marcarNova} onChange={(e) => setMarcarNova(e.target.checked)} /> {extra.rotulo}</label>}
                  <button type="button" className="botao botao-principal botao-pequeno" onClick={criar}>
                    <Icone nome="mais" tamanho={14} /> Criar “{texto.trim()}”
                  </button>
                </div>
              )}
              {erro && <p className="alerta alerta-erro">{erro}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
