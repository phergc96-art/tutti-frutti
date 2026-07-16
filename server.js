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

// Estructura de columnas basada en la plantilla del usuario
const CATEGORIAS_OFICIALES = ["Nombre", "Apellido", "Cosa", "Fruta o Verdura", "Animal", "Color", "País"];

// Base de datos integrada de validación rápida en español (ejemplos comunes para descarte básico)
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
        gameState.usedLetters = []; // Resetear si se agotan
        return TODAS_LETRAS[Math.floor(Math.random() * TODAS_LETRAS.length)];
    }
    const letra = letrasDisponibles[Math.floor(Math.random() * letrasDisponibles.length)];
    gameState.usedLetters.push(letra);
    return letra;
}

// Algoritmo de validación semántica básica
function esPalabraValida(palabra, letraEsperada, categoria) {
    if (!palabra) return false;
    const p = palabra.trim().toLowerCase();
    
    // Regla 1: Debe tener al menos 3 caracteres
    if (p.length < 3) return false;
    
    // Regla 2: Debe comenzar con la letra designada
    if (p[0] !== letraEsperada.toLowerCase()) return false;
    
    // Regla 3: Evitar spam o letras repetidas (ej. "aaaa", "asd", "abcde")
    if (/([a-z])\1{2,}/.test(p)) return false; // Bloquea 3 o más letras iguales seguidas
    
    // Patrones de spam de teclado común
    const spamPatterns = ["qwe", "asd", "zxc", "asd", "jkl", "123"];
    if (spamPatterns.some(pattern => p.includes(pattern))) return false;

    // Validación según categoría contra listas dinámicas
    const catNorm = categoria.toLowerCase();
    if (catNorm.includes("nombre")) {
        // Permitir si es un nombre común o pasa filtros generales de estructura silábica
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
    
    // Para cosas, colores, frutas, animales: estructura silábica básica válida en español
    return /^[a-zñáéíóúü\s]{3,20}$/.test(p);
}

io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);

    socket.on('joinGame', (username) => {
        gameState.players[socket.id] = {
            id: socket.id,
            username: username,
            answersByRound: {}, // Almacena respuestas indexadas por el número de ronda
            score: 0,
            roundScore: 0
        };
        socket.emit('initValues', { categories: gameState.categories, maxRounds: gameState.maxRounds });
        io.emit('updatePlayers', Object.values(gameState.players));
    });

    socket.on('startGame', (config) => {
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

            // Preparar estructuras de jugadores para esta ronda
            for (let id in gameState.players) {
                gameState.players[id].answersByRound[gameState.currentRound] = {};
                gameState.players[id].roundScore = 0;
            }

            // Avisar a todos para iniciar la preparación física (3, 2, 1)
            io.emit('prepareNextRound', {
                letter: gameState.currentLetter,
                currentRound: gameState.currentRound,
                maxRounds: gameState.maxRounds
            });
        }
    });

    socket.on('tuttiFrutti', (answers) => {
        if (gameState.isGameActive) {
            gameState.isGameActive = false;
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
        console.log(`Usuario desconectado: ${socket.id}`);
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

    // Reiniciar los puntajes de esta ronda para el cálculo actual
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

            // 1. VALIDACIÓN estricta de sentido real y concordancia
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

            // Reglas de negocio: +50 repetido, +100 único
            let puntosAsignados = esRepetida ? 50 : 100;
            gameState.players[idActual].detailedScoresByRound[roundNum][cat] = puntosAsignados;
            gameState.players[idActual].roundScore += puntosAsignados;
        });
    });

    // Sumar al global
    ids.forEach(id => {
        gameState.players[id].score += gameState.players[id].roundScore;
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor de Tutti-Frutti corriendo en el puerto ${PORT}`);
});
