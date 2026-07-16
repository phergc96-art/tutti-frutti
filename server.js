const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const CATEGORIAS_OFICIALES = ["Nombre", "Apellido", "Cosa", "Fruta o Verdura", "Animal", "Color", "País"];

const diccionarioValidacion = {
    nombres: ["andres", "andrea", "alonso", "anthony", "alejandro", "beatriz", "bruno", "carlos", "camila", "daniel", "diego", "elena", "eduardo", "fernando", "gabriela", "hugo", "isabel", "javier", "jose", "luis", "lucia", "manuel", "maria", "nicolas", "oscar", "pablo", "pedro", "raquel", "sofia", "tomas", "valeria", "victor", "walter"],
    apellidos: ["alvarez", "almada", "arias", "aguilar", "benitez", "blanco", "castro", "chavez", "diaz", "dominguez", "espinoza", "fernandez", "flores", "garcia", "gomez", "gutierrez", "hernandez", "jimenez", "lopez", "martinez", "mendoza", "morales", "munoz", "ortiz", "perez", "ramirez", "ramos", "rodriguez", "ruiz", "sanchez", "silva", "torres", "vargas", "vasquez"],
    paises: ["argentina", "argelia", "alemania", "angola", "australia", "austria", "belgica", "bolivia", "brasil", "canada", "chile", "china", "colombia", "ecuador", "espana", "francia", "grecia", "guatemala", "honduras", "india", "italia", "japon", "mexico", "nicaragua", "panama", "paraguay", "peru", "rusia", "uruguay", "venezuela"]
};

let gameState = {
    players: {},
    usedLetters: [],
    currentLetter: '',
    isGameActive: false,
    categories: CATEGORIAS_OFICIALES,
    currentRound: 0,
    maxRounds: 5,
    submissionsReceived: 0
};

const TODAS_LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function obtenerLetraAleatoria() {
    const letrasDisponibles = TODAS_LETRAS.filter(l => !gameState.usedLetters.includes(l));
    if (letrasDisponibles.length === 0) {
        gameState.usedLetters = [];
        return TODAS_LETRAS[Math.floor(Math.random() * TODAS_LETRAS.length)];
    }
    const letra = letrasDisponibles[Math.floor(Math.random() * letrasDisponibles.length)];
    gameState.usedLetters.push(letra);
    return letra;
}

function esPalabraValida(palabra, letraEsperada, categoria) {
    if (!palabra) return false;
    const p = palabra.trim().toLowerCase();
    
    if (p.length < 3) return false;
    if (p[0] !== letraEsperada.toLowerCase()) return false;
    if (/([a-z])\1{2,}/.test(p)) return false; 
    
    const spamPatterns = ["qwe", "asd", "zxc", "asd", "jkl", "123"];
    if (spamPatterns.some(pattern => p.includes(pattern))) return false;

    const catNorm = categoria.toLowerCase();
    if (catNorm.includes("nombre")) {
        if (diccionarioValidacion.nombres.includes(p)) return true;
        return /^[a-zñáéíóú]{3,12}$/.test(p);
    }
    if (catNorm.includes("apellido")) {
        if (diccionarioValidacion.apellidos.includes(p)) return true;
        return /^[a-zñáéíóú]{3,15}$/.test(p);
    }
    if (catNorm.includes("país") || catNorm.includes("pais")) {
        if (diccionarioValidacion.paises.includes(p)) return true;
    }
    
    return /^[a-zñáéíóúü\s]{3,20}$/.test(p);
}

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    socket.on('joinGame', (username) => {
        gameState.players[socket.id] = {
            id: socket.id,
            username: username,
            answersByRound: {},
            score: 0,
            roundScore: 0
        };
        socket.emit('initValues', { categories: gameState.categories, maxRounds: gameState.maxRounds });
        io.emit('updatePlayers', Object.values(gameState.players));
    });

    socket.on('startGame', (config) => {
        // Permitimos iniciar si el juego no está activo
        if (!gameState.isGameActive) {
            gameState.isGameActive = true;
            if (config && config.maxRounds) {
                gameState.maxRounds = parseInt(config.maxRounds);
            }
            if (gameState.currentRound === 0) {
                gameState.usedLetters = [];
            }
            gameState.currentRound++;
            gameState.submissionsReceived = 0;
            gameState.currentLetter = obtenerLetraAleatoria();

            for (let id in gameState.players) {
                gameState.players[id].answersByRound[gameState.currentRound] = {};
                gameState.players[id].roundScore = 0;
            }

            io.emit('prepareNextRound', {
                letter: gameState.currentLetter,
                currentRound: gameState.currentRound,
                maxRounds: gameState.maxRounds
            });
        }
    });

    socket.on('tuttiFrutti', (answers) => {
        if (gameState.isGameActive) {
            gameState.isGameActive = false; // Detener estado del juego de inmediato
            if (gameState.players[socket.id]) {
                gameState.players[socket.id].answersByRound[gameState.currentRound] = answers;
            }
            io.emit('stopGame', { winner: gameState.players[socket.id]?.username || 'Alguien' });
        }
    });

    socket.on('submitAnswers', (answers) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].answersByRound[gameState.currentRound] = answers;
        }
        
        gameState.submissionsReceived++;
        const totalPlayers = Object.keys(gameState.players).length;

        if (gameState.submissionsReceived >= totalPlayers) {
            calcularPuntajesRonda(gameState.currentRound);
            io.emit('showResults', {
                players: Object.values(gameState.players),
                currentRound: gameState.currentRound,
                maxRounds: gameState.maxRounds,
                letter: gameState.currentLetter
            });
        }
    });

    socket.on('resetGame', () => {
        gameState.isGameActive = false;
        gameState.currentLetter = '';
        gameState.currentRound = 0;
        gameState.usedLetters = [];
        for (let id in gameState.players) {
            gameState.players[id].score = 0;
            gameState.players[id].roundScore = 0;
            gameState.players[id].answersByRound = {};
        }
        io.emit('gameReset', { categories: gameState.categories });
    });

    socket.on('disconnect', () => {
        delete gameState.players[socket.id];
        io.emit('updatePlayers', Object.values(gameState.players));
        if (Object.keys(gameState.players).length === 0) {
            gameState.isGameActive = false;
            gameState.currentRound = 0;
            gameState.usedLetters = [];
        }
    });
});

function calcularPuntajesRonda(roundNum) {
    const ids = Object.keys(gameState.players);
    const letra = gameState.currentLetter;

    ids.forEach(id => {
        gameState.players[id].roundScore = 0;
        if (!gameState.players[id].detailedScoresByRound) {
            gameState.players[id].detailedScoresByRound = {};
        }
        gameState.players[id].detailedScoresByRound[roundNum] = {};
    });

    gameState.categories.forEach(cat => {
        ids.forEach(idActual => {
            let answersActual = gameState.players[idActual].answersByRound[roundNum] || {};
            let palabraActual = (answersActual[cat] || "").trim();

            if (!esPalabraValida(palabraActual, letra, cat)) {
                gameState.players[idActual].detailedScoresByRound[roundNum][cat] = 0;
                return;
            }

            let esRepetida = false;
            let normalizadaActual = palabraActual.toLowerCase();

            ids.forEach(idOtro => {
                if (idActual !== idOtro) {
                    let answersOtro = gameState.players[idOtro].answersByRound[roundNum] || {};
                    let palabraOtra = (answersOtro[cat] || "").trim().toLowerCase();
                    if (palabraOtra && esPalabraValida(palabraOtra, letra, cat)) {
                        if (normalizadaActual === palabraOtra) {
                            esRepetida = true;
                        }
                    }
                }
            });

            let puntosAsignados = esRepetida ? 50 : 100;
            gameState.players[idActual].detailedScoresByRound[roundNum][cat] = puntosAsignados;
            gameState.players[idActual].roundScore += puntosAsignados;
        });
    });

    ids.forEach(id => {
        gameState.players[id].score += gameState.players[id].roundScore;
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de Tutti-Frutti corriendo en el puerto ${PORT}`);
});
