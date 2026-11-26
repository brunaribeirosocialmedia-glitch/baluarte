import { useEffect, useState } from 'react'
import Modal from '../../components/Modal'
import Icone from '../../components/Icone'
import { desligar, ehIOS, inscricaoAtual, instalado, ligar, suportado, testar } from '../../lib/lembretes'

// Botão + janela para ligar o lembrete dos prospects em Aquecendo neste aparelho
export default function LembreteCelular() {
  const [aberto, setAberto] = useState(false)
  const [ligado, setLigado] = useState(null) // null = conferindo
  const [mensagem, setMensagem] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!aberto) return
    inscricaoAtual().then((i) => setLigado(!!i))
  }, [aberto])

  async function acao(fn, sucesso) {
    setOcupado(true)
    setMensagem('')
    try {
      setMensagem(await fn() || sucesso)
    } catch (e) {
      console.warn('[Baluarte] lembrete', e)
      setMensagem(e.message === 'permissao'
        ? 'O celular não deu permissão para notificações. Libere nas configurações do aparelho e tente de novo.'
        : 'Não consegui agora. Confira a internet e tente de novo.')
    }
    setLigado(!!(await inscricaoAtual()))
    setOcupado(false)
  }

  const precisaInstalar = ehIOS() && !instalado()

  return (
    <>
      <button type="button" className="botao botao-secundario" onClick={() => setAberto(true)}>
        <Icone nome="sino" tamanho={18} /> Lembrete
      </button>
      {aberto && (
        <Modal titulo="Lembrete dos prospects em Aquecendo" aoFechar={() => setAberto(false)} largura={500}>
          <div className="formulario">
            <p>
              De <strong>segunda a sexta, às 9h</strong>, chega uma notificação com quem está em <strong>Aquecendo</strong>,
              para você lembrar de passar no Instagram e dar atenção a eles. Se não tiver ninguém em Aquecendo, não chega nada.
            </p>

            {precisaInstalar ? (
              <div className="alerta">
                <p><strong>No iPhone, primeiro instale o Baluarte:</strong></p>
                <ol className="passos-instalar">
                  <li>Abra este endereço no <strong>Safari</strong>.</li>
                  <li>Toque em <strong>Compartilhar</strong> (o quadrado com a seta).</li>
                  <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
                  <li>Abra o Baluarte pelo ícone novo, entre e volte aqui.</li>
                </ol>
              </div>
            ) : !suportado() ? (
              <p className="alerta">Este navegador não recebe notificações. No celular, use o Chrome (Android) ou o Baluarte instalado (iPhone).</p>
            ) : ligado === null ? (
              <p className="texto-suave">Conferindo este aparelho…</p>
            ) : (
              <>
                <p className={ligado ? 'alerta alerta-ok' : 'texto-suave'}>
                  {ligado ? 'Ligado neste aparelho.' : 'Desligado neste aparelho.'}
                </p>
                <div className="botoes-lembrete">
                  {ligado ? (
                    <>
                      <button type="button" className="botao botao-principal" disabled={ocupado}
                        onClick={() => acao(async () => {
                          const r = await testar()
                          return r.ok ? 'Enviado! Deve chegar em alguns segundos.' : `O teste não foi entregue. ${r.detalhe}`
                        })}>
                        Mandar um teste agora
                      </button>
                      <button type="button" className="botao botao-secundario" disabled={ocupado}
                        onClick={() => acao(desligar, 'Lembrete desligado neste aparelho.')}>
                        Desligar
                      </button>
                    </>
                  ) : (
                    <button type="button" className="botao botao-principal" disabled={ocupado}
                      onClick={() => acao(ligar, 'Lembrete ligado! Toque em “Mandar um teste agora” para ver como chega.')}>
                      Ligar neste aparelho
                    </button>
                  )}
                </div>
              </>
            )}
            {mensagem && <p className="texto-suave">{mensagem}</p>}
            <p className="texto-suave dica-campo">Vale para cada aparelho separadamente: ligue no celular onde você quer receber.</p>
          </div>
        </Modal>
      )}
    </>
  )
}
