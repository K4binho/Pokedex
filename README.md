# Pokédex Classic · K4

**[Abrir Pokédex online](https://k4binho.github.io/Pokedex/)** — site estático gratuito hospedado pelo GitHub Pages.

Pokédex interativa com visual de duas telas, construída em **HTML, CSS e JavaScript** e conectada à [PokéAPI](https://pokeapi.co/). Sem framework, servidor ou chave de API.

## Interface

A primeira tela mostra a imagem, a pesquisa inteligente com sugestões e o **seletor dos jogos Pokémon**, agrupados pela geração dos jogos (I–IX). Ao escolher uma edição, anterior, próximo e aleatório passam a percorrer os registros da Pokédex do jogo, preservando a ordem do catálogo correspondente. **Todos os detalhes ficam na segunda tela** em seis abas:

| Aba | Informações |
| --- | --- |
| Resumo / Overview | Altura, peso, estatísticas e perfil de batalha estimado |
| Evolução / Evolution | Cadeia evolutiva, requisitos e local específico quando registrado; locais de captura por edição |
| Combate / Battle | Fraquezas, resistências, imunidades e multiplicadores defensivos |
| Golpes / Moves | Até quatro sugestões por grupo de versões, com tipo, poder, precisão e aprendizado |
| Habilidades / Abilities | Habilidades comuns, ocultas e explicações, com destaque geral estimado |
| Favoritos / Favorites | Lista de Pokémon salva localmente |

Os botões das abas ocupam a segunda tela sem empilhar os painéis sob a Pokédex. Também funcionam com **←/→, Home e End** quando um botão de aba está focado. A última aba visitada é lembrada durante a sessão.

O cabeçalho permite alternar entre **PT-BR e English**, sem atualizar a página. Os nomes das habilidades conhecidas têm traduções livres em português, tanto no resumo quanto nos detalhes; para termos raros ainda não traduzidos, o nome original em inglês é mantido em vez de apresentar uma tradução não verificada. O idioma fica salvo no navegador. Os nomes canônicos de Pokémon e golpes permanecem identificáveis pela PokéAPI; descrições sem tradução podem aparecer em inglês.

## Filtro por jogo: diferença importante

O filtro não usa a geração em que cada espécie estreou e **não** corresponde a intervalos de números da Pokédex Nacional.

- Os jogos aparecem agrupados por geração: **I (Red/Blue, Yellow)**, **II (Gold/Silver, Crystal)**, e assim por diante até **IX (Scarlet/Violet)**.
- A seleção consulta `version-group/{jogo}` e os recursos `pokedex/{região}` da PokéAPI, combinando Pokédex regionais adicionais quando disponíveis. Isso inclui Pokémon de gerações anteriores que constam na Pokédex daquele jogo.
- O filtro representa os Pokémon **registrados na Pokédex do jogo**, e não todos os Pokémon obtidos por transferência, eventos, trocas ou atualizações sem Pokédex própria.
- Se a PokéAPI não possuir dados suficientes para uma edição, o site informa a falha sem atribuir Pokémon incorretamente àquele jogo.
- A lista de referência cobre as espécies nacionais de 1 a 1025; formas especiais compartilham a espécie base quando aplicável.

A seleção é salva de forma independente do antigo filtro numérico, para evitar preferências incorretas após a atualização.

## Recursos adicionais

- Animação de Pokébola abrindo o site (respeita preferência por movimento reduzido).
- Busca por nome ou número, sugestões em tempo real para digitação parcial e erros comuns, e filtro pelas Pokédex dos jogos (Red/Blue, Gold/Silver, Ruby/Sapphire, X/Y, Sword/Shield, Scarlet/Violet etc.).
- Navegação anterior, próximo e Pokémon aleatório.
- Arte oficial e sprite alternativo.
- Favoritos persistidos localmente (até 50).
- Navegação acessível, mensagens de carregamento e falha de conexão.
- Requisições de guias carregadas apenas ao abrir suas abas, evitando buscas desnecessárias.

## Sobre evolução e lugares

**Como evoluir:** o painel mostra requisitos registrados na PokéAPI, como nível, troca, pedras, amizade, horário, golpe conhecido e, quando disponível, localização específica. Se não houver uma localização cadastrada, a interface explica essa limitação em vez de inventar um lugar.

**Onde encontrar:** a segunda parte da aba Evolução consulta `pokemon/{id}/encounters` e permite selecionar a edição do jogo **entre as que têm registros de encontros selvagens**. Não cobre necessariamente trocas, eventos, presentes, ovos ou versões sem dados.

Informações de evolução, golpes e habilidades podem mudar conforme o jogo ou geração. **Golpes, funções e naturezas são sugestões heurísticas**, não uma classificação oficial ou uma build competitiva garantida.

## Execução e testes

Abra `pokedex/index.html`, ou execute um servidor estático na raiz:

```bash
python -m http.server 8000
```

Endereço local: `http://localhost:8000`.

```bash
node --check pokedex/script.js
node --check pokedex/guide.js
node --check pokedex/enhancements.js
node --check pokedex/i18n.js
node --check pokedex/tabs.js
node --check pokedex/catalog.js
node --check pokedex/search.js
node --check pokedex/ability-names.js
node --test tests/*.test.cjs
```

O GitHub Actions verifica sintaxe, testes das regras de jogo e lógica das abas/idiomas. Conferência visual e consulta à PokéAPI continuam exigindo testes em navegador conectado.

## Publicação

GitHub Pages configurado para a branch `main`, diretório `/(root)`. O `index.html` inicial redireciona para `/pokedex/`. Alterações aprovadas na `main` geram um novo deploy automaticamente.

## Arquivos principais

```text
index.html                  # Entrada do GitHub Pages
pokedex/index.html          # Layout das duas telas e abas
pokedex/style.css           # Estilo do dispositivo e responsividade
pokedex/script.js           # Pesquisa, imagem, estatísticas e favoritos
pokedex/guide.js            # Regras puras de nomes, evolução, tipos e golpes
pokedex/enhancements.js     # Consultas sob demanda e conteúdo das abas
pokedex/i18n.js             # Português / inglês com preferência persistente
pokedex/tabs.js             # Navegação e foco acessível entre abas
pokedex/catalog.js          # Grupos de jogos, dados das Pokédex e busca inteligente
pokedex/search.js           # Autocompletar e seleção da Pokédex de cada jogo
pokedex/ability-names.js    # Glossário PT-BR (traduções livres)
tests/*.test.cjs            # Testes automatizados Node
```

Projeto independente, sem afiliação à Nintendo, Game Freak ou The Pokémon Company.
