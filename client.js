const socket = io();

const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const resultsScreen = document.getElementById('results-screen');

const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const playersList = document.getElementById('players-list');
const startBtn = document.getElementById('start-btn');
const roundsSelect = document.getElementById('rounds-select');
const currentLetter = document.getElementById('current-letter');
const roundIndicator = document.getElementById('round-indicator');
const inputsContainer = document.getElementById('inputs-container');
const stopBtn = document.getElementById('stop-btn');
const winnerAnnouncement = document.getElementById('winner-announcement');
const resultsTableContainer = document.getElementById('results-table-container');
const leaderboardList = document.getElementById('leaderboard-list');
const nextRoundBtn = document.getElementById('next-round-btn');
const resetBtn = document.getElementById('reset-btn');
const resultsTitle = document.getElementById('results-title');

let myUsername = "";
let gameCategories = [];

document.addEventListener("DOMContentLoaded", () => {
    const savedName = localStorage.getItem("tutti_frutti_username");
    if (savedName) {
        usernameInput.value = savedName;
    }
});

joinBtn.addEventListener('click', () => {
    myUsername = usernameInput.value.trim();
    if (myUsername) {
        localStorage.setItem("tutti_frutti_username", myUsername);
        socket.emit('joinGame', myUsername);
        loginScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
    }
});

startBtn.addEventListener('click', () => {
    socket.emit('startGame', { maxRounds: roundsSelect.value });
});

stopBtn.addEventListener('click', () => {
    const answers = getFormData();
    socket.emit('tuttiFrutti', answers);
});

nextRoundBtn.addEventListener('click', () => {
    socket.emit('startGame', { maxRounds: roundsSelect.value });
});

resetBtn.addEventListener('click', () => {
    socket.emit('resetGame');
});

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
    roundIndicator.textContent = `Ronda: ${data.currentRound} / ${data.maxRounds}`;
    currentLetter.textContent = data.letter;
    buildForm(data.categories);
    
    // SOLUCIÓN AL PROBLEMA DEL STOP: Reactivar el botón al iniciar la nueva ronda
    stopBtn.disabled = false;
    
    loginScreen.classList.add('hidden');
    lobbyScreen.classList.add('hidden');
    resultsScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
});

socket.on('stopGame', (data) => {
    const inputs = inputsContainer.querySelectorAll('input');
    inputs.forEach(input => input.disabled = true);
    stopBtn.disabled = true;
    
    winnerAnnouncement.textContent = `¡${data.winner} gritó ¡STOP! 🛑`;
    
    const answers = getFormData();
    socket.emit('submitAnswers', answers);
});

socket.on('showResults', (data) => {
    gameScreen.classList.add('hidden');
    resultsScreen.classList.remove('hidden');
    
    resultsTitle.textContent = `Resultados Ronda ${data.currentRound} de ${data.maxRounds}`;
    
    if (data.currentRound >= data.maxRounds) {
        nextRoundBtn.classList.add('hidden');
        winnerAnnouncement.textContent = "🏆 ¡PARTIDA FINALIZADA! Revisa el podio abajo.";
    } else {
        nextRoundBtn.classList.remove('hidden');
    }

    resultsTableContainer.innerHTML = '';
    gameCategories.forEach(cat => {
        const catBlock = document.createElement('div');
        catBlock.className = 'result-block';
        catBlock.innerHTML = `<h4>${cat}</h4>`;
        
        data.players.forEach(p => {
            const ans = p.answers[cat] || '---';
            const pts = p.detailedScores ? p.detailedScores[cat] : 0;
            const row = document.createElement('div');
            row.className = 'player-res';
            // Mostrar la palabra junto con los puntos individuales obtenidos en ese campo
            row.innerHTML = `<span><strong>${p.username}:</strong> ${ans} <small style="color: green; font-weight:bold;">(+${pts} pts)</small></span>`;
            catBlock.appendChild(row);
        });
        resultsTableContainer.appendChild(catBlock);
    });

    leaderboardList.innerHTML = '';
    const sortedPlayers = data.players.sort((a, b) => b.score - a.score);
    sortedPlayers.forEach((p, index) => {
        const li = document.createElement('li');
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.innerHTML = `<span>${index + 1}. <strong>${p.username}</strong> (+${p.roundScore} pts esta ronda)</span> <span><strong>${p.score} Pts Totales</strong></span>`;
        leaderboardList.appendChild(li);
    });
});

socket.on('gameReset', () => {
    resultsScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    stopBtn.disabled = false;
});

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
