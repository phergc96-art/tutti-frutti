const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos directamente desde la raíz (como está en tu GitHub)
app.use(express.static(path.join(__dirname)));

// Ruta principal explícita apuntando al index.html en la raíz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Estado global del juego
let gameState = {
    players: {},
    currentLetter: '',
    isGameActive: false,
    categories: ["Nombre", "País/Ciudad", "Animal", "Objeto", "Comida", "Color"]
};

const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    socket.on('joinGame', (username) => {
        gameState.players[socket.id] = {
            id: socket.id,
            username: username,
            answers: {},
            ready: false
        };
        socket.emit('initValues', { categories: gameState.categories });
        io.emit('updatePlayers', Object.values(gameState.players));
    });

    socket.on('startGame', () => {
        if (!gameState.isGameActive) {
            gameState.isGameActive = true;
            gameState.currentLetter = letras[Math.floor(Math.random() * letras.length)];
            
            for (let id in gameState.players) {
                gameState.players[id].answers = {};
            }

            io.emit('gameStarted', {
                letter: gameState.currentLetter,
                categories: gameState.categories
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
        io.emit('showResults', Object.values(gameState.players));
    });

    socket.on('resetGame', () => {
        gameState.isGameActive = false;
        gameState.currentLetter = '';
        io.emit('gameReset', { categories: gameState.categories });
    });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado: ${socket.id}`);
        delete gameState.players[socket.id];
        io.emit('updatePlayers', Object.values(gameState.players));
        if (Object.keys(gameState.players).length === 0) {
            gameState.isGameActive = false;
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
