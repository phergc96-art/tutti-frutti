const socket = io();

// Screens
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const countdownScreen = document.getElementById('countdown-screen');
const gameScreen = document.getElementById('game-screen');
const resultsScreen = document.getElementById('results-screen');

// Elements
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
const nextRoundBtn = document.getElementById('next-round-btn');
const resetBtn = document.getElementById('reset-btn');
const resultsTitle = document.getElementById('results-title');
const excelBody = document.getElementById('excel-body');
const tableHeaders = document.getElementById('table-headers');
const resultsHeaders = document.getElementById('results-headers');
const resultsComparisonBody = document.getElementById('results-comparison-body');
const countdownTimer = document.getElementById('countdown-timer');
const nextLetterDisplay = document.getElementById('next-letter-display');

let myUsername = "";
let gameCategories = [];
let totalGameRounds = 5;
let currentRoundNum = 0;

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
    socket.emit('startGame', { maxRounds: totalGameRounds });
});

resetBtn.addEventListener('click', () => {
    socket.emit('resetGame');
});

socket.on('initValues', (data) => {
    gameCategories = data.categories;
    totalGameRounds = data.maxRounds;
    generarEstructuraTablaExcel();
});

socket.on('updatePlayers', (players) => {
    playersList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `👤 ${p.username} ${p.id === socket.id ? '(Tú)' : ''}`;
        playersList.appendChild(li);
    });
});

// Cuenta regresiva 3, 2, 1 antes de jugar
socket.on('prepareNextRound', (data) => {
    currentRoundNum = data.currentRound;
    totalGameRounds = data.maxRounds;
    
    // Configurar pantallas
    loginScreen.classList.add('hidden');
    lobbyScreen.classList.add('hidden');
    resultsScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    countdownScreen.classList.remove('hidden');

    nextLetterDisplay.textContent = data.letter;

    let secondsLeft = 3;
    countdownTimer.textContent = secondsLeft;

    const timerInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0) {
            countdownTimer.textContent = secondsLeft;
        } else {
            clearInterval(timerInterval);
            countdownScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            
            // Iniciar ronda de verdad
            roundIndicator.textContent = `Fila activa: ${data.currentRound} / ${data.maxRounds}`;
            currentLetter.textContent = data.letter;
            buildForm(data.categories);
            stopBtn.disabled = false;
        }
    }, 1000);
});

socket.on('stopGame', (data) => {
    // Bloquear inmediatamente formulario para evitar escritura
    const inputs = inputsContainer.querySelectorAll('input');
    inputs.forEach(input => input.disabled = true);
    stopBtn.disabled = true;
    
    winnerAnnouncement.textContent = `¡${data.winner} presionó el STOP! 🛑 Evaluando palabras...`;
    
    const answers = getFormData();
    socket.emit('submitAnswers', answers);
});

socket.on('showResults', (data) => {
    resultsScreen.classList.remove('hidden');
    resultsTitle.textContent = `Resultados de la Partida (Fila ${data.currentRound})`;

    // Determinar si es la partida final del juego
    if (data.currentRound >= data.maxRounds) {
        nextRoundBtn.classList.add('hidden');
        winnerAnnouncement.innerHTML += `<br><strong style="color:var(--primary); font-size:1.2rem;">🏆 ¡CAMPEONATO CONCLUIDO!</strong>`;
    } else {
        nextRoundBtn.classList.remove('hidden');
    }

    // Actualizar la Plantilla Excel Visual con las respuestas de este jugador
    const miJugador = data.players.find(p => p.id === socket.id);
    if (miJugador) {
        escribirFilaExcel(data.currentRound, data.letter, miJugador.answersByRound[data.currentRound], miJugador.detailedScoresByRound[data.currentRound], miJugador.roundScore);
        actualizarSumaTotal(miJugador.score);
    }

    // Generar la tabla comparativa en la ventana de resultados
    generarTablaComparacion(data.players, data.currentRound, data.letter);
});

socket.on('gameReset', (data) => {
    resultsScreen.classList.add('hidden');
    gameScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    stopBtn.disabled = false;
    currentRoundNum = 0;
    generarEstructuraTablaExcel();
});

// Inicializa las cabeceras de Excel y genera filas vacías de la 1 a la 15
function generarEstructuraTablaExcel() {
    tableHeaders.innerHTML = `<th>Letra</th>`;
    gameCategories.forEach(cat => {
        const th = document.createElement('th');
        th.textContent = cat;
        tableHeaders.appendChild(th);
    });
    const thPuntaje = document.createElement('th');
    thPuntaje.textContent = "Puntaje";
    tableHeaders.appendChild(thPuntaje);

    excelBody.innerHTML = '';
    for (let r = 1; r <= 15; r++) {
        const tr = document.createElement('tr');
        tr.id = `excel-row-${r}`;
        tr.innerHTML = `<td class="row-label">Fila ${r}</td>` + 
                       Array(gameCategories.length).fill('<td></td>').join('') + 
                       `<td class="score-cell">-</td>`;
        excelBody.appendChild(tr);
    }
    
    // Fila final de suma acumulada
    const totalTr = document.createElement('tr');
    totalTr.id = "excel-total-row";
    totalTr.innerHTML = `<td colspan="${gameCategories.length + 1}" style="text-align: right; font-weight: bold; background: #ffeaa7;">SUMA TOTAL:</td>` +
                        `<td id="excel-sum-total" style="font-weight: bold; background: #ffeaa7; text-align: center;">0</td>`;
    excelBody.appendChild(totalTr);
}

function escribirFilaExcel(roundNum, letra, answers, scores, roundScore) {
    const row = document.getElementById(`excel-row-${roundNum}`);
    if (row) {
        let htmlStr = `<td class="letter-cell">${letra}</td>`;
        gameCategories.forEach(cat => {
            const val = answers[cat] || '---';
            const pts = scores[cat] !== undefined ? scores[cat] : 0;
            let colorClase = pts === 100 ? 'pt-100' : (pts === 50 ? 'pt-50' : 'pt-0');
            htmlStr += `<td class="${colorClase}">${val} <span class="bubble-score">${pts}</span></td>`;
        });
        htmlStr += `<td class="score-total-cell">${roundScore} pts</td>`;
        row.innerHTML = htmlStr;
    }
}

function actualizarSumaTotal(totalScore) {
    const tdTotal = document.getElementById('excel-sum-total');
    if (tdTotal) {
        tdTotal.textContent = `${totalScore} Pts`;
    }
}

// Compara las palabras de todos los jugadores en un modal para mayor transparencia
function generarTablaComparacion(players, roundNum, letra) {
    resultsHeaders.innerHTML = `<th>Jugador</th>`;
    gameCategories.forEach(cat => {
        const th = document.createElement('th');
        th.textContent = cat;
        resultsHeaders.appendChild(th);
    });
    const thTotal = document.createElement('th');
    thTotal.textContent = "Ronda";
    resultsHeaders.appendChild(thTotal);

    resultsComparisonBody.innerHTML = '';
    players.forEach(p => {
        const tr = document.createElement('tr');
        if (p.id === socket.id) tr.style.backgroundColor = '#f1f2f6';
        
        let htmlStr = `<td><strong>${p.username}</strong></td>`;
        gameCategories.forEach(cat => {
            const ans = p.answersByRound[roundNum]?.[cat] || '---';
            const pts = p.detailedScoresByRound?.[roundNum]?.[cat] || 0;
            const ptsColor = pts > 0 ? 'color: green;' : 'color: red;';
            htmlStr += `<td>"${ans}" <br><small style="${ptsColor} font-weight: bold;">+${pts}</small></td>`;
        });
        htmlStr += `<td style="font-weight:bold; text-align:center;">${p.roundScore || 0}</td>`;
        tr.innerHTML = htmlStr;
        resultsComparisonBody.appendChild(tr);
    });
}

function buildForm(categories) {
    inputsContainer.innerHTML = '';
    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label>${cat}</label>
            <input type="text" id="cat-${cat}" autocomplete="off" placeholder="..." maxlength="25">
        `;
        inputsContainer.appendChild(div);
    });
    // Poner el foco de forma automática en el primer input
    setTimeout(() => {
        const firstInput = inputsContainer.querySelector('input');
        if (firstInput) firstInput.focus();
    }, 100);
}

function getFormData() {
    const answers = {};
    gameCategories.forEach(cat => {
        const input = document.getElementById(`cat-${cat}`);
        answers[cat] = input ? input.value.trim() : '';
    });
    return answers;
}
