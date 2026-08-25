# Histórico de propostas + cadastro de pacientes — Google Sheets / Apps Script

A v70 mantém o gerador hospedado no Render e usa o Google Sheets como banco de dados do histórico. O Apps Script funciona como API intermediária.

## Estrutura do banco

A planilha usa duas abas:

- `Pacientes`: um cadastro por paciente.
- `Propostas`: uma ou mais versões de orçamento vinculadas à paciente.

Na aba `Pacientes`, além dos campos técnicos, a v70 armazena somente os dados cadastrais definidos para documentos:

1. Nome completo
2. Data de nascimento
3. CPF
4. Sexo
5. E-mail
6. Celular
7. CEP
8. Endereço

Também é guardado, de forma técnica, o `amigo_id` para reconhecer a mesma paciente nas próximas importações.

## Atualização de uma instalação existente

Se o histórico da v69 já está funcionando:

1. Substitua os arquivos do PWA no GitHub/Render pela v70.
2. No Google Apps Script, substitua todo o conteúdo de `Code.gs` pelo arquivo da v70.
3. Salve.
4. Vá em **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**.
5. A URL `/exec` e o token podem permanecer os mesmos.

A v70 migra automaticamente a aba `Pacientes`, acrescentando as novas colunas cadastrais ao final. Não apague nem reordene os cabeçalhos existentes.

Opcionalmente, execute `setupHistoryDatabase()` novamente uma vez após a atualização para reaplicar a formatação da planilha. O token existente não é resetado.

## Cadastro manual

No gerador:

1. Selecione uma paciente do histórico.
2. A linha **Cadastro da paciente** mostra `x/8` ou `8/8 ✓`.
3. Toque nessa linha ou abra **Mais opções → Cadastro da paciente**.
4. Edite os campos necessários e clique **Salvar cadastro**.

O cadastro é único por paciente e vale para todas as versões de proposta dessa paciente.

## Atualizar cadastros pelo Amigo (.xlsx)

1. No Amigo, exporte a planilha completa de pacientes em `.xlsx`.
2. No gerador: **Histórico → Mais opções → Atualizar cadastros pelo Amigo (.xlsx)**.
3. Selecione o arquivo exportado.

O arquivo é lido no próprio navegador. O aplicativo procura correspondências apenas entre pacientes que já possuem pelo menos uma proposta cadastrada no histórico. Pacientes sem qualquer orçamento são ignorados.

A prioridade de identificação é:

1. `amigo_id` já vinculado;
2. CPF;
3. nome + data de nascimento;
4. nome completo exato e único.

Pacientes do XLSX que não possuem orçamento no gerador são ignorados e não são enviados ao Google Sheets.

Os campos importados são:

- Nome
- Data de nascimento
- CPF
- Sexo
- E-mail
- Celular
- CEP
- Endereço

O endereço é montado a partir de endereço, número, complemento, bairro, cidade e estado da exportação do Amigo.

Ao final o aplicativo informa quantos cadastros foram atualizados, quantos já estavam iguais, quantos registros do XLSX não foram usados e se houve correspondências ambíguas.

## Exportação para o jurídico

O botão **Exportar resumo para jurídico** não usa mais questionário clínico.

O resumo reúne automaticamente:

- os 8 campos cadastrais;
- procedimentos;
- hospital;
- data prevista da cirurgia;
- condições financeiras;
- pagamentos a terceiros;
- prótese, tecnologias, cola, modeladores e seguro;
- data e versão da proposta.

Campos cadastrais ausentes aparecem como `PENDENTE`.

O documento termina com a observação de que se destina à elaboração do contrato e termos relacionados ao procedimento e não constitui prontuário ou anamnese.

## Segurança e privacidade

- O arquivo XLSX do Amigo é processado no navegador; o arquivo completo não é enviado ao Apps Script.
- Somente os cadastros que correspondem a pacientes com orçamento são enviados à planilha.
- Mantenha a planilha privada.
- Não coloque o `API_TOKEN` no GitHub ou no `index.html`.
- URL e token continuam armazenados apenas no navegador de cada aparelho.

## Teste mínimo recomendado após a atualização

1. Confirme que o topo mostra **v70**.
2. Selecione uma paciente do histórico.
3. Abra **Cadastro da paciente** e confirme que o status aparece como `1/8` caso exista apenas o nome.
4. Importe uma exportação do Amigo que contenha essa paciente.
5. Confirme que o status passa para `8/8 ✓` quando todos os campos estiverem presentes.
6. Abra o cadastro e confira os valores.
7. Clique **Exportar resumo para jurídico** e confirme os dados cadastrais e financeiros.
8. Faça o mesmo no iPhone para confirmar a sincronização via Google Sheets.
