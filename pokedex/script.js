const pokemon = document.querySelector('#poke');
const nome = document.querySelector('.nome');
const img = document.querySelector('.img');

pokemon.addEventListener('change', function () {
    const promiseResposta = fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.value}`);

    promiseResposta.then(function(resposta){
        const promiseBody = resposta.json();

        promiseBody.then(function(body){
            console.log(body)
            nome.textContent = body.name;
            img.src = body.sprites.front_default;
        })
    })

});

//