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
    // IMPORTANTE: habilitar botón de stop y limpiar para el siguiente inicio
    stopBtn.disabled = false;
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

socket.on('prepareNextRound', (data) => {
    currentRoundNum = data.currentRound;
    totalGameRounds = data.maxRounds;
    
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
            
            roundIndicator.textContent = `Fila activa: ${data.currentRound} / ${data.maxRounds}`;
            currentLetter.textContent = data.letter;
            
            // Habilitar los inputs del Excel para esta ronda activa
            habilitarInputsFilaExcel(data.currentRound, data.letter);
            stopBtn.disabled = false;
        }
    }, 1000);
});

socket.on('stopGame', (data) => {
    // Bloquear de forma estricta todos los inputs de la tabla Excel
    const inputs = excelBody.querySelectorAll('input');
    inputs.forEach(input => input.disabled = true);
    stopBtn.disabled = true;
    
    winnerAnnouncement.innerHTML = `🚨 ¡<strong>${data.winner}</strong> presionó el STOP! 🛑 Evaluando respuestas...`;
    
    const answers = getFormData();
    socket.emit('submitAnswers', answers);
});

socket.on('showResults', (data) => {
    resultsScreen.classList.remove('hidden');
    resultsTitle.textContent = `Resultados de la Partida (Fila ${data.currentRound})`;

    if (data.currentRound >= data.maxRounds) {
        nextRoundBtn.classList.add('hidden');
        winnerAnnouncement.innerHTML += `<br><strong style="color:var(--primary); font-size:1.2rem;">🏆 ¡CAMPEONATO CONCLUIDO!</strong>`;
    } else {
        nextRoundBtn.classList.remove('hidden');
    }

    const miJugador = data.players.find(p => p.id === socket.id);
    if (miJugador) {
        escribirFilaExcelConResultados(data.currentRound, data.letter, miJugador.answersByRound[data.currentRound], miJugador.detailedScoresByRound[data.currentRound], miJugador.roundScore);
        actualizarSumaTotal(miJugador.score);
    }

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

// Inicializa las cabeceras de Excel y genera filas vacías de la 1 a la 15 con el número de fila
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
        
        // El primer elemento de la fila indica el número de fila inicialmente
        let rowHtml = `<td class="row-label" id="row-label-${r}">Fila ${r}</td>`;
        gameCategories.forEach(() => {
            rowHtml += `<td></td>`;
        });
        rowHtml += `<td class="score-cell">-</td>`;
        tr.innerHTML = rowHtml;
        excelBody.appendChild(tr);
    }
    
    // Fila final de suma acumulada
    const totalTr = document.createElement('tr');
    totalTr.id = "excel-total-row";
    totalTr.innerHTML = `<td colspan="${gameCategories.length + 1}" style="text-align: right; font-weight: bold; background: #ffeaa7;">SUMA TOTAL:</td>` +
                        `<td id="excel-sum-total" style="font-weight: bold; background: #ffeaa7; text-align: center;">0 Pts</td>`;
    excelBody.appendChild(totalTr);
}

// Reemplaza la fila estática de la ronda actual por inputs reales de Excel editables
function habilitarInputsFilaExcel(roundNum, letra) {
    const row = document.getElementById(`excel-row-${roundNum}`);
    if (row) {
        // En la columna Letra se pone la letra que ha salido aleatoriamente
        let htmlStr = `<td class="letter-cell-active" id="row-label-${roundNum}"><strong>${letra}</strong></td>`;
        
        gameCategories.forEach(cat => {
            htmlStr += `<td class="cell-input-container">
                <input type="text" id="excel-input-${cat}" class="excel-inline-input" autocomplete="off" placeholder="..." maxlength="25">
            </td>`;
        });
        
        htmlStr += `<td class="score-cell">Jugando...</td>`;
        row.innerHTML = htmlStr;

        // Auto-enfocar el primer input de la tabla de forma fluida
        setTimeout(() => {
            const primerInput = row.querySelector('input');
            if (primerInput) primerInput.focus();
        }, 150);
    }
}

// Transforma la fila editable de inputs a texto estático mostrando colores de puntuación
function escribirFilaExcelConResultados(roundNum, letra, answers, scores, roundScore) {
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

function getFormData() {
    const answers = {};
    gameCategories.forEach(cat => {
        const input = document.getElementById(`excel-input-${cat}`);
        answers[cat] = input ? input.value.trim() : '';
    });
    return answers;
}
