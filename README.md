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


## Alterações da v53
- No iPhone/iPad, a geração do PDF não tenta mais forçar um download que o Safari pode abrir em uma aba. O app mostra “PDF pronto” e o botão **Salvar / compartilhar PDF**, usando a folha de compartilhamento nativa quando disponível. Escolha **Salvar em Arquivos** para guardar o PDF.
- Tipografia pequena das páginas 2, 3 e 4 foi ampliada para melhorar a leitura em telas de celular.
- O botão **Visualizar PDF** continua disponível separadamente para conferência.
