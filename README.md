# Pokédex Classic

**[Abrir Pokédex online](https://k4binho.github.io/Pokedex/)** — hospedada gratuitamente no GitHub Pages.

Uma Pokédex responsiva inspirada no dispositivo clássico, construída com **HTML, CSS e JavaScript puro** e dados da [PokéAPI](https://pokeapi.co/).

## Recursos

- **Abertura com animação:** Pokébola centralizada entra na tela e se abre para revelar o site. Respeita a opção do sistema para reduzir animações.
- **Busca inteligente:** ao digitar um nome incorreto (por exemplo, "pikach"), a Pokédex sugere nomes semelhantes e permite abrir a opção correta com um clique.
- **Guia do treinador:** perfil de batalha, naturezas e prioridades de atributos sugeridas; fraquezas, resistências, imunidades e multiplicadores de dano.
- **Evoluções:** família completa, inclusive ramificações, condições (nível, item, troca, amizade, horário etc.) e navegação entre as etapas.
- **Habilidades:** descrições explicativas e destaque estimado de habilidades com bom potencial geral.
- **Golpes sugeridos por jogo:** escolha do grupo de versões da PokéAPI; até quatro golpes escolhidos por critérios heurísticos (STAB, atributos, poder, precisão e funções de apoio). Exibe categoria e método de aprendizado.

**Atenção:** a PokéAPI fornece dados dos jogos; as recomendações são heurísticas e não pretendem representar builds competitivas oficiais. Evoluções e movimentos podem variar conforme geração, edição e regras específicas. Alguns textos de habilidades podem aparecer em inglês quando não há resumo em português.


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

O arquivo `index.html` da raiz redireciona para `/pokedex/`.

Para ativar a hospedagem gratuita **uma única vez**:

1. Acesse [Settings → Pages](https://github.com/K4binho/Pokedex/settings/pages).
2. Em **Build and deployment**, selecione **Deploy from a branch**.
3. Escolha **main** e **/(root)**, depois clique em **Save**.
4. Quando o GitHub concluir o primeiro deploy, abra **https://k4binho.github.io/Pokedex/**.

Após essa ativação, cada atualização na branch `main` será publicada automaticamente no GitHub Pages.

## Verificação

```bash
node --check pokedex/script.js
node --check pokedex/guide.js
node --check pokedex/enhancements.js
node --test tests/*.test.cjs
```

Checklist manual: pesquisar por nome correto e nome incorreto; clicar nas sugestões; trocar versões do jogo; abrir evoluções ramificadas (ex.: Eevee); conferir imunidades por tipo; verificar favoritos, erros de rede, teclado e layout móvel. A automação verifica sintaxe e regras de recomendação, mas não substitui testes visuais e funcionais no navegador.

## Organização

```text
index.html                 # redirecionamento de entrada
pokedex/index.html         # interface
pokedex/style.css          # layout responsivo e tema retrô
pokedex/script.js          # API, navegação e favoritos
pokedex/guide.js           # lógica testável de buscas, evolução e estratégia
pokedex/enhancements.js    # carregamento assíncrono e interface do guia
tests/guide.test.cjs       # testes automatizados
pokedex/*.png              # imagens originais mantidas no projeto
```

Este é um projeto independente de estudo e não é afiliado à Nintendo, Game Freak ou The Pokémon Company.
