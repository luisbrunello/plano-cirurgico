# Plano Cirúrgico PWA — v64

Versão com cálculo automático do Hospital Pietà por procedimento.

## Regra Pietà
- Hospital: maior valor isolado + 50% de cada procedimento adicional.
- Anestesista: maior valor isolado + 50% de cada procedimento adicional.
- Consulta pré-anestésica: R$ 150,00 adicionados ao total do anestesista.
- Os valores isolados por procedimento ficam salvos localmente no navegador.
- Para outros hospitais, os campos continuam manuais.

# Plano Cirúrgico — PWA

Pacote pronto para publicar como **Static Site** no Render.

## Estrutura
- `index.html` — gerador completo (baseado na v51).
- `manifest.webmanifest` — nome, cores e instalação como web app.
- `service-worker.js` — cache do app; após o primeiro carregamento online, também tenta manter `html2canvas` em cache para geração de PDF offline.
- `icons/` — ícones PWA/iPhone criados a partir do símbolo da logo oficial.
- `robots.txt` — solicita aos mecanismos de busca que não indexem o site.

## Configuração recomendada no Render
- Service type: `Static Site`
- Branch: `main`
- Build Command: `echo "static site"`
- Publish Directory: `.`

## Privacidade
O projeto é estático e não inclui backend/banco de dados. Os dados preenchidos permanecem no navegador.
O campo do questionário jurídico foi mantido fora de “Salvar padrões”.
A URL do Static Site continua acessível para quem a conhecer. `robots.txt` e `noindex`
reduzem indexação, mas não são autenticação.


## Alterações da v55
- No iPhone/iPad, a geração do PDF não tenta mais forçar um download que o Safari pode abrir em uma aba. O app mostra “PDF pronto” e o botão **Salvar / compartilhar PDF**, usando a folha de compartilhamento nativa quando disponível. Escolha **Salvar em Arquivos** para guardar o PDF.
- Tipografia pequena das páginas 2, 3 e 4 foi ampliada para melhorar a leitura em telas de celular.
- O botão **Visualizar PDF** continua disponível separadamente para conferência.


## v55 — tipografia física no PDF
A tipografia das páginas 2–4 passou a usar tamanhos em `pt` na camada final do CSS, com corpo de texto ampliado para leitura confortável no iPhone e escala mais previsível entre iOS e desktop. O painel operacional continua usando `px`.


## v60 - Tabelas Pietà 2026
Valores do Hospital Pietà e honorários anestésicos 2026 integrados ao cálculo automático. Mantém consulta pré-anestésica de R$ 150,00 adicionada uma única vez ao total de anestesia.


## Hospital Firenze — v60

A tabela 2026 do Hospital Firenze foi integrada com cálculo de cirurgias combinadas: maior valor integral + 50% dos demais, separadamente para hospital e anestesia. Valores ambíguos por duração e procedimentos sem correspondência explícita permanecem editáveis no painel.


## v60
- Adicionado como primeiro item fixo em “Entenda sua proposta”: **Acompanhamento em consultório**.
- O item descreve planejamento, retorno pré-operatório, suporte via WhatsApp e cronograma habitual de consultas pós-operatórias, com possibilidade de ajuste individual.


## v61 — ordem da página “Entenda sua proposta”
- Acompanhamento em consultório permanece como primeiro item fixo.
- “Acompanhamento nutrológico” passou a “Avaliação com médica nutróloga”, identificando a Dra. Giovanna Spagnuolo.
- Ordem principal: consultório → nutróloga → seguro → prótese → tecnologias → cola → modeladores → tratamento externo.
- Materiais especiais e correção de cicatriz/queloide continuam preservados quando aplicáveis, após os itens principais.
- Estrutura do procedimento permanece no bloco inferior.


## v62 — entrada configurável e múltiplos procedimentos manuais
- Entrada/sinal: 20% dos honorários médicos por padrão ou valor fixo definido manualmente.
- O restante junto ao médico é recalculado automaticamente conforme a entrada selecionada.
- O resumo jurídico acompanha a forma de cálculo escolhida.
- A seção de procedimentos permite adicionar múltiplos procedimentos manuais, com remoção individual.


## v63 — modeladores editáveis e nomenclatura da página 3
- Os valores unitários dos modeladores pós-operatórios existentes agora podem ser editados diretamente no painel.
- É possível adicionar modeladores personalizados, com nome, valor unitário, quantidade, subtotal e remoção individual.
- Modeladores personalizados participam dos cálculos, da proposta e do resumo jurídico quando selecionados.
- “Pagamento a fornecedores” na página 3 foi alterado para “Pagamento a terceiros”.


## v64 — auditoria financeira e correções de segurança
- Quando o cálculo automático de Pietà ou Firenze fica incompleto, os totais de hospital/anestesia são limpos e bloqueados, evitando reaproveitamento silencioso de valores antigos.
- A geração do PDF é bloqueada enquanto um cálculo automático de hospital estiver incompleto.
- Firenze: lipoenxertia glútea passa a custo hospitalar/anestésico adicional zero quando há uma lipoaspiração efetivamente cobrada, conforme a regra publicada de que o enxerto glúteo está incluído na lipoaspiração.
- Firenze: Lipoaspiração de abdome não é cobrada novamente quando combinada com Abdominoplastia ou Mini-abdominoplastia, pois a tabela inclui lipo de frente/abdome dentro do tempo previsto.
