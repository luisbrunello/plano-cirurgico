# Plano Cirúrgico PWA — v60

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
