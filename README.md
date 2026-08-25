# Plano Cirúrgico PWA — v71

Gerador mobile-first de propostas cirúrgicas com histórico em Google Sheets, versões de orçamento, cálculo automático para Hospital Pietà/Firenze e cadastro cadastral discreto de pacientes.

## Novidades da v71

- Auditoria adicional do histórico/cadastro: preservação correta do vínculo da paciente ao criar nova versão após importação do Amigo.
- Proteção do resumo jurídico contra mistura acidental de dados cadastrais de outra paciente.
- Validação mais rigorosa da estrutura da planilha do histórico e das colunas essenciais da exportação do Amigo.
- Importação em lote otimizada no Apps Script.
- Cadastro por paciente com 8 campos essenciais: nome, nascimento, CPF, sexo, e-mail, celular, CEP e endereço.
- Status compacto `x/8` dentro do Histórico.
- Edição manual do cadastro em **Mais opções**.
- Importação da exportação completa `.xlsx` do Amigo.
- O XLSX é lido localmente no navegador; somente pacientes que já possuem orçamento são enviados ao Google Sheets.
- Vínculo técnico pelo `amigo_id`, com fallback por CPF, nome+nascimento e nome completo exato.
- Resumo jurídico simplificado: cadastro + planejamento + condições financeiras + itens contratados + controle da proposta.
- Campos cadastrais ausentes são marcados como `PENDENTE`.
- O antigo questionário clínico para o jurídico foi removido do fluxo.

## Estrutura

- `index.html` — aplicativo completo.
- `manifest.webmanifest` — configuração PWA.
- `service-worker.js` — cache v71.
- `google-apps-script/Code.gs` — API do histórico e cadastro.
- `google-apps-script/appsscript.json` — manifesto de referência do Apps Script.
- `HISTORICO_GOOGLE_SHEETS_PASSO_A_PASSO.md` — instruções de atualização e uso.
- `icons/` — ícones do PWA.

## Atualização do Apps Script

A v71 altera o esquema da aba `Pacientes`. Substitua o `Code.gs` e publique uma **nova versão** da implantação existente. A URL `/exec` e o token podem permanecer os mesmos.

As novas colunas são acrescentadas automaticamente ao final da aba `Pacientes`; os registros e propostas existentes são preservados.

## Privacidade

O Google Sheets guarda apenas o histórico comercial/orçamentário e os 8 dados cadastrais definidos para documentação. O aplicativo não importa o restante das informações clínicas presentes na exportação do Amigo.
