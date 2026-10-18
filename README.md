# Pokédex Classic

Uma Pokédex responsiva inspirada no dispositivo clássico, construída com **HTML, CSS e JavaScript puro** e dados da [PokéAPI](https://pokeapi.co/).

## Recursos

- Pesquisa de Pokémon por nome ou número (1–1025), incluindo nomes com espaços e variações de maiúsculas/minúsculas.
- Navegação anterior/próximo, botão aleatório e atalhos de teclado **← / →** quando nenhum campo ou botão está selecionado.
- Arte oficial com fallback para sprite, tipos traduzidos, altura, peso, habilidades e estatísticas base.
- Favoritos persistidos localmente (até 50) e restauração do último Pokémon consultado.
- Layout adaptado a desktop, tablet e celular; estados de carregamento, erro e foco acessível.
- Sem framework, instalação ou chave de API.

## Executar localmente

Abra `pokedex/index.html` no navegador. Para desenvolvimento, também é possível servir a pasta raiz com um servidor estático:

```bash
python -m http.server 8000
```

Acesse `http://localhost:8000`. É necessário ter internet para consultar a PokéAPI, baixar as imagens e carregar as fontes. Se a API estiver indisponível, a aplicação exibe uma mensagem de erro sem apagar o Pokémon exibido.

## Publicação

O arquivo `index.html` da raiz redireciona para `/pokedex/`. Para hospedar no GitHub Pages, configure **Settings → Pages → Deploy from a branch → main → /(root)** após integrar as alterações.

## Verificação

```bash
node --check pokedex/script.js
```

Checklist manual: buscar por nome e ID; testar inexistente e sem conexão; navegar nos limites 1 e 1025; favoritar/remover e recarregar; usar teclado; inspecionar layout em telas pequenas. O fluxo do GitHub Actions faz a verificação de sintaxe do JavaScript, mas não substitui testes visuais e funcionais no navegador.

## Organização

```text
index.html                 # redirecionamento de entrada
pokedex/index.html         # interface
pokedex/style.css          # layout responsivo e tema retrô
pokedex/script.js          # API, navegação e favoritos
pokedex/*.png              # imagens originais mantidas no projeto
```

Este é um projeto independente de estudo e não é afiliado à Nintendo, Game Freak ou The Pokémon Company.
