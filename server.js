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

const CATEGORIAS_OFICIALES = ["Nombre", "Apellido", "País", "Color", "Animal", "Cosa", "Fruta", "Profesión"];
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

let gameState = {
    players: {},
    currentLetter: '',
    isGameActive: false,
    categories: CATEGORIAS_OFICIALES,
    currentRound: 0,
    maxRounds: 5,
    submissionsReceived: 0
};

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    socket.on('joinGame', (username) => {
        gameState.players[socket.id] = {
            id: socket.id,
            username: username,
            answers: {},
            score: 0,
            roundScore: 0,
            detailedScores: {} // Almacena el desglose de puntos por categoría
        };
        socket.emit('initValues', { categories: gameState.categories, maxRounds: gameState.maxRounds });
        io.emit('updatePlayers', Object.values(gameState.players));
    });

    socket.on('startGame', (config) => {
        if (!gameState.isGameActive) {
            gameState.isGameActive = true;
            gameState.maxRounds = parseInt(config.maxRounds) || 5;
            gameState.currentRound++;
            gameState.submissionsReceived = 0;
            gameState.currentLetter = LETRAS[Math.floor(Math.random() * LETRAS.length)];
            
            for (let id in gameState.players) {
                gameState.players[id].answers = {};
                gameState.players[id].roundScore = 0;
                gameState.players[id].detailedScores = {};
            }

            io.emit('gameStarted', {
                letter: gameState.currentLetter,
                categories: gameState.categories,
                currentRound: gameState.currentRound,
                maxRounds: gameState.maxRounds
            });
        }
    });

    socket.on('tuttiFrutti', (answers) => {
        if (gameState.isGameActive) {
            gameState.isGameActive = false;
            if (gameState.players[socket.id]) {
                gameState.players[socket.id].answers = answers;
            }
            io.emit('stopGame', { winner: gameState.players[socket.id]?.username || 'Alguien' });
        }
    });

    socket.on('submitAnswers', (answers) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].answers = answers;
        }
        
        gameState.submissionsReceived++;
        const totalPlayers = Object.keys(gameState.players).length;

        if (gameState.submissionsReceived >= totalPlayers) {
            calcularPuntajes();
            io.emit('showResults', {
                players: Object.values(gameState.players),
                currentRound: gameState.currentRound,
                maxRounds: gameState.maxRounds
            });
        }
    });

    socket.on('resetGame', () => {
        gameState.isGameActive = false;
        gameState.currentLetter = '';
        gameState.currentRound = 0;
        for (let id in gameState.players) {
            gameState.players[id].score = 0;
            gameState.players[id].roundScore = 0;
            gameState.players[id].answers = {};
            gameState.players[id].detailedScores = {};
        }
        io.emit('gameReset', { categories: gameState.categories });
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        delete gameState.players[socket.id];
        io.emit('updatePlayers', Object.values(gameState.players));
        if (Object.keys(gameState.players).length === 0) {
            gameState.isGameActive = false;
            gameState.currentRound = 0;
        }
    });
});

function calcularPuntajes() {
    const ids = Object.keys(gameState.players);
    const letraActual = gameState.currentLetter.toLowerCase();
    
    // Inicializar estructuras de la ronda
    ids.forEach(id => {
        gameState.players[id].roundScore = 0;
        gameState.categories.forEach(cat => {
            gameState.players[id].detailedScores[cat] = 0;
            if (!gameState.players[id].answers[cat]) {
                gameState.players[id].answers[cat] = "";
            }
        });
    });

    gameState.categories.forEach(cat => {
        ids.forEach(idActual => {
            let palabraActual = gameState.players[idActual].answers[cat].trim().toLowerCase();

            // VALIDACIONES ESTRICTAS DE PALABRA REAL / COHERENTE:
            // 1. Campo vacío -> 0 puntos
            // 2. Que tenga menos de 3 letras -> 0 puntos (Evita "A", "An", etc.)
            // 3. Que NO empiece con la letra de la ronda -> 0 puntos
            if (!palabraActual || palabraActual.length < 3 || !palabraActual.startsWith(letraActual)) {
                gameState.players[idActual].detailedScores[cat] = 0;
                return; 
            }

            let esRepetida = false;

            ids.forEach(idOtro => {
                if (idActual !== idOtro) {
                    let palabraOtra = gameState.players[idOtro].answers[cat].trim().toLowerCase();
                    // Solo comparamos contra otras palabras válidas (de longitud >= 3 y que empiecen con la letra)
                    if (palabraOtra && palabraOtra.length >= 3 && palabraOtra.startsWith(letraActual)) {
                        if (palabraActual === palabraOtra) {
                            esRepetida = true;
                        }
                    }
                }
            });

            // Asignación de puntos según tus reglas de negocio exactas
            if (esRepetida) {
                gameState.players[idActual].detailedScores[cat] = 50;
                gameState.players[idActual].roundScore += 50;
            } else {
                gameState.players[idActual].detailedScores[cat] = 100;
                gameState.players[idActual].roundScore += 100;
            }
        });
    });

    // Acumular puntaje al global
    ids.forEach(id => {
        gameState.players[id].score += gameState.players[id].roundScore;
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
