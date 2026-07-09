const socket = io();

// Elementos del DOM
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const resultsScreen = document.getElementById('results-screen');

const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const playersList = document.getElementById('players-list');
const startBtn = document.getElementById('start-btn');
const currentLetter = document.getElementById('current-letter');
const inputsContainer = document.getElementById('inputs-container');
const stopBtn = document.getElementById('stop-btn');
const winnerAnnouncement = document.getElementById('winner-announcement');
const resultsTableContainer = document.getElementById('results-table-container');
const nextRoundBtn = document.getElementById('next-round-btn');

let myUsername = "";
let gameCategories = [];

// Eventos de usuario
joinBtn.addEventListener('click', () => {
    myUsername = usernameInput.value.trim();
    if (myUsername) {
        socket.emit('joinGame', myUsername);
        loginScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
    }
});

startBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

stopBtn.addEventListener('click', () => {
    const answers = getFormData();
    socket.emit('tuttiFrutti', answers);
});

nextRoundBtn.addEventListener('click', () => {
    socket.emit('resetGame');
});

// Respuestas del Servidor en Tiempo Real (Sockets)
socket.on('initValues', (data) => {
    gameCategories = data.categories;
});

socket.on('updatePlayers', (players) => {
    playersList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `👤 ${p.username} ${p.id === socket.id ? '(Tú)' : ''}`;
        playersList.appendChild(li);
    });
});

socket.on('gameStarted', (data) => {
    currentLetter.textContent = data.letter;
    buildForm(data.categories);
    
    lobbyScreen.classList.add('hidden');
    resultsScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
});

socket.on('stopGame', (data) => {
    // Bloquear de inmediato las entradas táctiles y de teclado
    const inputs = inputsContainer.querySelectorAll('input');
    inputs.forEach(input => input.disabled = true);
    stopBtn.disabled = true;
    
    winnerAnnouncement.textContent = `¡${data.winner} gritó TUTTI FRUTTI!`;
    
    // Enviar lo que se llegó a escribir de inmediato
    const answers = getFormData();
    socket.emit('submitAnswers', answers);
});

socket.on('showResults', (playersData) => {
    gameScreen.classList.add('hidden');
    resultsScreen.classList.remove('hidden');
    
    // Renderizar las respuestas de todos de forma estructurada
    resultsTableContainer.innerHTML = '';
    
    gameCategories.forEach(cat => {
        const catBlock = document.createElement('div');
        catBlock.className = 'result-block';
        catBlock.innerHTML = `<h4>${cat}</h4>`;
        
        playersData.forEach(p => {
            const ans = p.answers[cat] || '---';
            const row = document.createElement('div');
            row.className = 'player-res';
            row.innerHTML = `<span><strong>${p.username}:</strong></span> <span>${ans}</span>`;
            catBlock.appendChild(row);
        });
        
        resultsTableContainer.appendChild(catBlock);
    });
});

socket.on('gameReset', () => {
    resultsScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    stopBtn.disabled = false;
});

// Funciones Auxiliares
function buildForm(categories) {
    inputsContainer.innerHTML = '';
    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label>${cat}</label>
            <input type="text" id="cat-${cat}" autocomplete="off" autocapitalize="words">
        `;
        inputsContainer.appendChild(div);
    });
}

function getFormData() {
    const answers = {};
    gameCategories.forEach(cat => {
        const input = document.getElementById(`cat-${cat}`);
        answers[cat] = input ? input.value.trim() : '';
    });
    return answers;
}