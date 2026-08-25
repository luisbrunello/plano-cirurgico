# Histórico de propostas — Google Sheets + Apps Script

Esta pasta deixa a versão v67 praticamente pronta. O gerador continua hospedado no Render. O Google Sheets funciona como banco de dados e o Apps Script como API intermediária.

## O que é salvo

- nome da paciente;
- datas do orçamento e da cirurgia;
- procedimentos;
- hospital;
- valores e condições financeiras;
- todas as opções necessárias para reconstruir a proposta;
- versão do aplicativo;
- snapshot completo da proposta.

**Não é salvo:** o conteúdo do campo de questionário clínico/jurídico.

## 1. Criar a planilha

1. No Google Drive, crie uma planilha em branco.
2. Sugestão de nome: `Histórico - Planos Cirúrgicos`.
3. Não precisa criar abas ou colunas manualmente.

## 2. Abrir o Apps Script

1. Dentro da planilha: **Extensões → Apps Script**.
2. Apague o conteúdo do arquivo `Code.gs` criado automaticamente.
3. Copie todo o conteúdo de `google-apps-script/Code.gs` deste pacote e cole no editor.
4. Salve.

O arquivo `appsscript.json` deste pacote é apenas referência de configuração; para a primeira instalação não é necessário mexer no manifesto manualmente.

## 3. Criar as abas e o token

1. No seletor de funções do Apps Script, escolha `setupHistoryDatabase`.
2. Clique **Executar**.
3. Na primeira vez o Google pedirá autorização. Autorize usando a conta proprietária da planilha.
4. A função criará automaticamente as abas:
   - `Pacientes`
   - `Propostas`
5. Abra **Registro de execução**. Será exibido um `API_TOKEN` longo.
6. Copie esse token e guarde temporariamente. Ele será colado no aplicativo.

Os pedaços do snapshot ficam em colunas ocultas da aba `Propostas`. Não apague essas colunas.

## 4. Publicar como Web App

1. Apps Script → **Implantar → Nova implantação**.
2. Tipo: **App da Web**.
3. Executar como: **Eu**.
4. Quem pode acessar: **Qualquer pessoa**.
5. Clique **Implantar**.
6. Copie a URL terminada em `/exec`.

> O acesso público ao endpoint é protegido adicionalmente pelo token. O token não fica embutido no `index.html`; ele é informado uma vez no seu navegador e fica no localStorage daquele aparelho.

## 5. Configurar o gerador v67

1. Atualize o seu repositório/Render com a pasta `Plano_Cirurgico_PWA_v67`.
2. Abra o gerador.
3. No topo, abra **0. Histórico de propostas**.
4. Abra **Configurar conexão com Google Sheets**.
5. Cole:
   - URL do Web App;
   - API_TOKEN.
6. Clique **Salvar conexão**.
7. Clique **Testar conexão**.
8. O indicador deve mudar para **Conectado**.

Repita somente a configuração de URL/token em cada aparelho/navegador que você quiser usar. Ela não é sincronizada entre Mac e iPhone.

## 6. Uso diário

### Salvar uma paciente/proposta pela primeira vez

1. Monte a proposta normalmente.
2. Clique **Salvar como nova versão**.
3. Se o nome ainda não existir, o Apps Script cria a paciente.
4. A proposta é salva como `v1`.

### Salvar nova versão

1. Abra uma proposta pelo histórico ou mantenha a proposta atual carregada.
2. Faça as alterações.
3. Clique **Salvar como nova versão**.
4. O registro antigo permanece intacto e surge `v2`, `v3` etc.

### Sobrescrever a mesma versão

1. Abra a versão desejada.
2. Edite.
3. Clique **Salvar alterações**.
4. O aplicativo exige confirmação antes de substituir aquele snapshot.

### Abrir versão antiga

1. Selecione a paciente.
2. Selecione a versão.
3. Clique **Abrir versão**.

O gerador preserva os valores finais de hospital/anestesia gravados naquela versão. Isso evita que uma tabela hospitalar futura altere silenciosamente um orçamento antigo.

Se quiser aplicar as tabelas atuais, clique **Recalcular hospital/anestesia**.

### Arquivar

O botão **Arquivar versão** remove a versão da lista ativa, mas não apaga a linha da planilha.

## 7. Segurança prática

- Não compartilhe o `API_TOKEN`.
- Não coloque o token no GitHub ou dentro do `index.html`.
- A planilha deve permanecer privada na sua conta Google.
- O questionário clínico/jurídico não é enviado para o histórico.
- Se suspeitar que o token foi exposto, execute `resetApiToken()` no Apps Script e substitua o token nos seus aparelhos.
- Como o Web App precisa aceitar requisições do PWA hospedado no Render, a implantação é feita como “Qualquer pessoa”; o controle efetivo da API é o token. Para proteção mais forte no futuro, vale adicionar autenticação ao próprio PWA.

## 8. Backup

O Google Sheets já mantém histórico de versões da própria planilha. Além disso, os registros são legíveis nas abas `Pacientes` e `Propostas`.

Sugestão: periodicamente faça **Arquivo → Fazer download → Microsoft Excel (.xlsx)** como cópia externa.

## 9. Se mudar o Code.gs depois

Depois de alterações no Apps Script:

1. **Implantar → Gerenciar implantações**.
2. Edite a implantação existente.
3. Crie uma **nova versão**.
4. Implante.

Normalmente a URL `/exec` permanece a mesma.

## Teste mínimo recomendado

Antes de usar com propostas reais:

1. Paciente `Teste Histórico` → salve v1.
2. Altere honorários → salve como nova versão → deve aparecer v2.
3. Abra v1 → o valor original deve voltar.
4. Edite v1 e use **Salvar alterações** → somente v1 deve mudar.
5. Arquive v1 → ela deve desaparecer da lista ativa; v2 permanece.
6. Confira as duas abas diretamente no Google Sheets.

### Observação sobre nome da paciente

Se você abrir uma proposta antiga e apenas corrigir o nome da mesma paciente, use **Salvar alterações**. Se mudar o nome e usar **Salvar como nova versão**, o aplicativo evita anexar automaticamente a nova versão ao cadastro anterior quando o nome não coincide.


## Atualização para v67

A v67 adiciona proteção contra sobrescrita quando a mesma proposta é editada em outro dispositivo. Como essa proteção depende do Apps Script, substitua também o conteúdo do `Code.gs` pelo arquivo desta versão e, no Apps Script, abra **Implantar > Gerenciar implantações > Editar**, escolha **Nova versão** e publique novamente. A URL `/exec` da implantação pode permanecer a mesma. Não é necessário alterar a estrutura da planilha.
