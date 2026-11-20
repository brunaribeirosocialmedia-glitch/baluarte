import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase, traduzirErro } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const LINK_CONVITE = 'https://supabase.com/dashboard/project/kfcmcwxnqfofmworbojt/auth/users'

function Chave({ ligada, onChange, disabled, rotulo }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligada}
      aria-label={rotulo}
      className={`chave ${ligada ? 'ligada' : ''}`}
      onClick={() => onChange(!ligada)}
      disabled={disabled}
    >
      <span />
    </button>
  )
}

export default function Equipe() {
  const { session, permissoes, atualizarPermissoes } = useAuth()
  const [membros, setMembros] = useState(null)
  const [clientes, setClientes] = useState([])
  const [acessos, setAcessos] = useState([]) // pares { cliente_id, usuario_id }
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('perfis').select('*').order('nome').then(({ data }) => setMembros(data || []))
    supabase.from('clientes').select('id, nome, cor').order('nome').then(({ data }) => setClientes(data || []))
    supabase.from('cliente_membros').select('cliente_id, usuario_id').then(({ data }) => setAcessos(data || []))
  }, [])

  if (!permissoes.admin) return <Navigate to="/" replace />

  async function alterar(membro, campos) {
    setErro('')
    const anterior = membros
    setMembros(membros.map((m) => (m.id === membro.id ? { ...m, ...campos } : m)))
    const { error } = await supabase.from('perfis').update(campos).eq('id', membro.id)
    if (error) {
      setMembros(anterior)
      setErro(traduzirErro(error))
    } else if (membro.id === session.user.id) {
      atualizarPermissoes()
    }
  }

  const temAcesso = (membro, cliente) => acessos.some((a) => a.usuario_id === membro.id && a.cliente_id === cliente.id)

  async function alternarCliente(membro, cliente) {
    setErro('')
    const anterior = acessos
    const ligado = temAcesso(membro, cliente)
    setAcessos(ligado
      ? acessos.filter((a) => !(a.usuario_id === membro.id && a.cliente_id === cliente.id))
      : [...acessos, { cliente_id: cliente.id, usuario_id: membro.id }])
    const { error } = ligado
      ? await supabase.from('cliente_membros').delete().eq('cliente_id', cliente.id).eq('usuario_id', membro.id)
      : await supabase.from('cliente_membros').insert({ cliente_id: cliente.id, usuario_id: membro.id })
    if (error) {
      setAcessos(anterior)
      setErro(traduzirErro(error))
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <h1>Equipe</h1>
        <p className="texto-suave">
          Defina quem pode entrar no Comercial e na Gestão (mesmo com a permissão, a pessoa precisa digitar o código da área) e quais clientes cada pessoa da equipe vê. Quem é da equipe só enxerga os clientes marcados, no Início e na Área do Cliente.
        </p>
      </header>

      {erro && <p className="alerta alerta-erro">{erro}</p>}

      <div className="cartao tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Pessoa</th>
              <th>Papel</th>
              <th>Clientes</th>
              <th>Comercial</th>
              <th>Gestão</th>
              <th>Ativo</th>
            </tr>
          </thead>
          <tbody>
            {membros === null && (
              <tr><td colSpan={6} className="texto-suave">Carregando…</td></tr>
            )}
            {membros?.map((m) => {
              const souEu = m.id === session.user.id
              return (
                <tr key={m.id} className={m.ativo ? '' : 'inativo'}>
                  <td>
                    <strong>{m.nome || 'Sem nome'}{souEu && ' (você)'}</strong>
                    <small className="texto-suave bloco">{m.email}</small>
                  </td>
                  <td>
                    <select
                      value={m.papel}
                      disabled={souEu}
                      onChange={(e) => alterar(m, { papel: e.target.value })}
                      aria-label={`Papel de ${m.nome}`}
                    >
                      <option value="membro">Equipe</option>
                      <option value="admin">Administração</option>
                    </select>
                  </td>
                  <td className="celula-clientes">
                    {m.papel === 'admin' ? (
                      <span className="texto-suave">Todos</span>
                    ) : clientes.length === 0 ? (
                      <span className="texto-suave">Nenhum cliente cadastrado</span>
                    ) : (
                      <div className="clientes-da-pessoa">
                        {clientes.map((c) => (
                          <label key={c.id} className="marcar">
                            <input type="checkbox" checked={temAcesso(m, c)} onChange={() => alternarCliente(m, c)} />
                            <span className="ponto" style={{ background: c.cor || 'var(--texto-suave)' }} />
                            <span>{c.nome}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <Chave rotulo={`Comercial para ${m.nome}`} ligada={m.pode_prospeccao} onChange={(v) => alterar(m, { pode_prospeccao: v })} />
                  </td>
                  <td>
                    <Chave rotulo={`Gestão para ${m.nome}`} ligada={m.pode_financeiro} onChange={(v) => alterar(m, { pode_financeiro: v })} />
                  </td>
                  <td>
                    <Chave rotulo={`${m.nome} ativo`} ligada={m.ativo} disabled={souEu} onChange={(v) => alterar(m, { ativo: v })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="cartao dica">
        <strong>Adicionar alguém à equipe</strong>
        <p className="texto-suave">
          Por enquanto, os convites são enviados pelo painel do Supabase: <em>Add user → Send invitation</em>.
          A pessoa recebe um e-mail, cria a senha e aparece nesta lista — sem nenhum cliente marcado. Depois é só marcar, na coluna Clientes, o que ela pode ver.
        </p>
        <a className="botao botao-secundario" href={LINK_CONVITE} target="_blank" rel="noreferrer">Abrir painel de convites</a>
      </div>
    </div>
  )
}
