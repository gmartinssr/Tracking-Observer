# Tracking-Observer

Rastreador em tempo real para projetos web com JavaScript, HTML e CSS.

## Como usar

Execute apontando para a pasta do projeto que deseja observar:

```powershell
node C:\caminho\Tracking-Observer\tracker.js --project C:\caminho\meu-projeto
```

Depois abra `http://127.0.0.1:4173/` para usar o projeto e
`http://127.0.0.1:4173/__tracker/` para acompanhar a rota.

## Comando único

Para iniciar o rastreador e o projeto juntos:

```powershell
node C:\caminho\Tracking-Observer\run.js --project C:\caminho\meu-projeto
```

Se o projeto tiver `package.json` com o script `start`, ele será iniciado
automaticamente. Para escolher outro comando:

```powershell
node C:\caminho\Tracking-Observer\run.js --project C:\caminho\meu-projeto --command "npm run dev"
```

Para o projeto deste repositório, use:

```powershell
node C:\Users\User\Documents\Programas\Projetos\Tracking-Observer\run.js --project C:\Users\User\Documents\Programas\Projetos\Tracking-Observer\PI-II-TIME-V1 --entry Login/indexLogin.html
```

O comando detecta `PI-II-TIME-V1\backend`, inicia o `npm run start` dentro dele,
serve a tela `Login/indexLogin.html` pelo observador e encaminha chamadas
`/api/*` para o backend em `http://127.0.0.1:3000`.

Também é possível usar:

```powershell
npm run run -- --project C:\caminho\meu-projeto
```

O servidor injeta automaticamente o rastreador nos arquivos HTML. Ele registra
cliques, páginas acessadas, carregamento de JavaScript/CSS, `fetch`, XHR, erros e
marcadores explícitos. Os arquivos do projeto monitorado não são alterados.

Para indicar etapas internas importantes:

```javascript
window.__trackingObserver?.mark("validar credenciais");
```

Ou envolva uma função:

```javascript
const autenticar = window.__trackingObserver.wrap("autenticar usuário", autenticarOriginal);
```

Chamadas internas entre funções sem marcador não podem ser descobertas de forma
confiável apenas observando o navegador; por isso, use `mark` ou `wrap` nos pontos
de validação e autorização.
