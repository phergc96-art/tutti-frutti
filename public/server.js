const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Estructura oficial solicitada
const CATEGORIAS_OFICIALES = ["Nombre", "Apellido", "País", "Color", "Animal", "Cosa", "Fruta", "Profesión"];
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

let gameState = {
    players: {},
    currentLetter: '',
    isGameActive: false,
    categories: CATEGORIAS_OFICIALES,
    currentRound: 0,
    maxRounds: 5, // Valor por defecto
    submissionsReceived: 0
};

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    socket.on('joinGame', (username) => {
        // Conservar puntaje acumulado si el jugador ya existía o inicia en 0
        gameState.players[socket.id] = {
            id: socket.id,
            username: username,
            answers: {},
            score: 0,
            roundScore: 0
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
            
            // Limpiar respuestas de la ronda anterior
            for (let id in gameState.players) {
                gameState.players[id].answers = {};
                gameState.players[id].roundScore = 0;
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

        // Cuando todos hayan enviado sus respuestas tras el STOP, procesamos puntajes
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
        // Reinicio total del campeonato
        gameState.isGameActive = false;
        gameState.currentLetter = '';
        gameState.currentRound = 0;
        for (let id in gameState.players) {
            gameState.players[id].score = 0;
            gameState.players[id].roundScore = 0;
            gameState.players[id].answers = {};
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

// Función con tu lógica exacta de puntajes (0, 50, 100)
function calcularPuntajes() {
    const ids = Object.keys(gameState.players);
    
    // Inicializar puntajes de esta ronda en 0
    ids.forEach(id => {
        gameState.players[id].roundScore = 0;
        // Sanitizar respuestas (pasar a minúsculas y quitar espacios sobrantes)
        gameState.categories.forEach(cat => {
            if (!gameState.players[id].answers[cat]) {
                gameState.players[id].answers[cat] = "";
            }
        });
    });

    gameState.categories.forEach(cat => {
        ids.forEach(idActual => {
            let palabraActual = gameState.players[idActual].answers[cat].trim().toLowerCase();

            // Condición 1: Campo Vacío -> 0 puntos
            if (!palabraActual) {
                return; 
            }

            let esRepetida = false;
            let esUnica = true;

            ids.forEach(idOtro => {
                if (idActual !== idOtro) {
                    let palabraOtra = gameState.players[idOtro].answers[cat].trim().toLowerCase();
                    if (palabraOtra) {
                        esUnica = false; // Hay otros jugadores que respondieron algo
                        if (palabraActual === palabraOtra) {
                            esRepetida = true;
                        }
                    }
                }
            });

            // Condición 2: Palabra igual a otro jugador -> +50 puntos
            if (esRepetida) {
                gameState.players[idActual].roundScore += 50;
            } 
            // Condición 3: Diferente de los demás (o es el único que respondió) -> +100 puntos
            else {
                gameState.players[idActual].roundScore += 100;
            }
        });
    });

    // Sumar el acumulado global de cada jugador
    ids.forEach(id => {
        gameState.players[id].score += gameState.players[id].roundScore;
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
