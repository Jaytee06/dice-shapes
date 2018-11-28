var io = require('socket.io-client');
var Canvas = require('./canvas');
var global = require('./global');
var $ = require("jquery");

var socket;
var reason;
var gameGrid = [];
var players = [];
var player = {};

var debug = function(args) {
    if (console && console.log) {
        console.log(args);
    }
};


window.canvas = new Canvas({id: 'cvs', addEvents: true});
var c = window.canvas.cv;
var graph = c.getContext('2d');

var canvas2 = new Canvas({id: 'cvs2', addEvents: false});
var c2 = canvas2.cv;
var graph2 = c2.getContext('2d');

var nextShapeBtn;
var lRotateBtn;
var rRotateBtn;

window.onload = function() {

	nextShapeBtn = document.getElementById('nextShapeButton');
	lRotateBtn = document.getElementById('leftRotateButton');
	rRotateBtn = document.getElementById('rightRotateButton');

	nextShapeBtn.onclick = function() {
		socket.emit('next-shape');
	};
	lRotateBtn.onclick = function() {
		socket.emit('rotate-shape');
	};
	rRotateBtn.onclick = function() {
		socket.emit('rotate-shape');
	};

	startGame();
};

function startGame() {

	global.screenWidth = window.innerWidth;
	global.screenHeight = window.innerHeight;

	document.getElementById('gameAreaWrapper').style.opacity = 1;

	if (!socket) {
		socket = io();

		setupSocket(socket);

		socket.emit('join');
		window.canvas.socket = socket;
		global.socket = socket;
	}
}

// socket stuff.
function setupSocket(socket) {
    // Handle ping.
    socket.on('pongcheck', function () {
        var latency = Date.now() - global.startPingTime;
        debug('Latency: ' + latency + 'ms');
    });

    // Handle error.
    socket.on('connect_failed', function () {
        socket.close();
        global.disconnected = true;
    });

    socket.on('disconnect', function () {
        socket.close();
        global.disconnected = true;
    });

    // Handle connection.
    socket.on('welcome', function (playerSettings) {

    	player = playerSettings;
        socket.emit('gotit', playerSettings);
        global.gameStart = true;
        debug('Game started at: ' + global.gameStart);
		c.focus();
    });

    socket.on('gameSetup', function(data) {
        global.gameWidth = data.width;
        global.gameHeight = data.height;
        global.type = data.type;

		global.gridSize = global.screenWidth / data.width;

        c.width = window.innerWidth;
        c.height = window.innerWidth;
        c2.width = window.innerWidth/4;
        c2.height = window.innerWidth/4;
    });


    socket.on('playerDisconnect', function (data) {
        debug("Player disconnected "+ data.name);
    });

    socket.on('playerJoin', function (data) {
		debug("Player joined "+ data.name);
    });

    // Death.
    socket.on('RIP', function () {
        global.gameStart = false;
        global.died = true;
        window.setTimeout(function() {
            global.died = false;
        }, 2500);
    });

    socket.on('kick', function (data) {
        global.gameStart = false;
        reason = data;
        global.kicked = true;
        socket.close();
    });

	socket.on('state', function(data) {
		gameGrid = data.grid;
		players = data.users;

		if( player ) {
			var p = players.find((x) => x.id == player.id);
			if( p ) player = p;

			if( data.canStartGame && data.playersTurn && data.playersTurn.id == player.id ) {
                $(nextShapeBtn).attr("disabled", false);
                $(lRotateBtn).attr("disabled", false);
                $(rRotateBtn).attr("disabled", false);
            } else {
                $(nextShapeBtn).attr("disabled", true);
                $(lRotateBtn).attr("disabled", true);
                $(rRotateBtn).attr("disabled", true);
			}
		}

		gameLoop();
	});
}


function drawGrid() {
	let cursor = {x: 0, y: 0};
    gameGrid.forEach((grid) => {
		graph.lineWidth = 1;
		graph.strokeStyle = global.lineColor;
		graph.fillStyle = global.backgroundColor;
		graph.globalAlpha = 1;

		if( grid.possiblePlayer ) {
			graph.fillStyle = 'hsl(' + grid.possiblePlayer.hue + ', 100%, 50%, 0.6)';
		}

		if( grid.lockedPlayer ) {
			graph.fillStyle = 'hsl(' + grid.lockedPlayer.hue + ', 100%, 50%, 1)';
		}

		if (grid.type == 2 || grid.type == 4) {
			graph.fillRect(cursor.x, cursor.y, global.gridSize, global.gridSize);
			graph.strokeRect(cursor.x, cursor.y, global.gridSize, global.gridSize);

			if( grid.startingPlayer ) {
				graph.fillStyle = 'hsl(' + grid.startingPlayer.hue + ', 100%, 40%)';

				if( grid.row == 0 ) {
					graph.fillRect(cursor.x, cursor.y, global.gridSize, 0.1*global.gridSize);
					if( grid.col == 0 ) {
						graph.fillRect(cursor.x, cursor.y, 0.1*global.gridSize, global.gridSize);
					} else {
						graph.fillRect(cursor.x+0.9*global.gridSize, cursor.y, 0.1*global.gridSize, global.gridSize);
					}
				} else {
					graph.fillRect(cursor.x, cursor.y+0.9*global.gridSize, global.gridSize, 0.1*global.gridSize);
					if( grid.col == 0 ) {
						graph.fillRect(cursor.x, cursor.y, 0.1*global.gridSize, global.gridSize);
					} else {
						graph.fillRect(cursor.x+0.9*global.gridSize, cursor.y, 0.1*global.gridSize, global.gridSize);
					}
				}
			}

			// graph.fillStyle = 'black';
			// graph.font = '18px Courier';
			// graph.fillText(grid.row+','+grid.col, cursor.x, cursor.y+30);

			cursor.x += global.gridSize;
			if( grid.col == global.gameWidth-1 ) {
				cursor.x = 0;
				cursor.y += global.gridSize;
			}
		}
	});

	graph.stroke();
	graph.globalAlpha = 1;
}

function drawNextShapes() {

	graph2.fillStyle = global.backgroundColor;
	graph2.fillRect(0, 0, c2.width, c2.height);
	if( player.nextShape ) {
		var shape = player.nextShape;

		graph2.lineWidth = 1;
		graph2.strokeStyle = global.lineColor;
		graph2.fillStyle = 'hsl(' + player.hue + ', 100%, 50%)';

		var specs = {w:global.gridSize*shape.w, h:global.gridSize*shape.h};
		graph2.fillRect(c2.width/2-specs.w/2, c2.height/2-specs.h/2, specs.w, specs.h);
		graph2.strokeRect(c2.width/2-specs.w/2, c2.height/2-specs.h/2, specs.w, specs.h);

		graph2.stroke();
		graph2.globalAlpha = 1;
	}

}

function gameLoop() {
    if (global.died) {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, global.screenWidth, global.screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        graph.fillText('You died!', global.screenWidth / 2, global.screenHeight / 2);
    } else if (!global.disconnected) {
        if (global.gameStart) {
            graph.fillStyle = global.backgroundColor;
            graph.fillRect(0, 0, global.screenWidth, global.screenHeight);

            drawGrid();

            if( player ) {
				drawNextShapes();
			}

            socket.emit('0', window.canvas.target); // playerSendTarget "Heartbeat".

        } else {
            graph.fillStyle = '#333333';
            graph.fillRect(0, 0, global.screenWidth, global.screenHeight);

            graph.textAlign = 'center';
            graph.fillStyle = '#FFFFFF';
            graph.font = 'bold 30px sans-serif';
            graph.fillText('Game Over!', global.screenWidth / 2, global.screenHeight / 2);
        }
    } else {
        graph.fillStyle = '#333333';
        graph.fillRect(0, 0, global.screenWidth, global.screenHeight);

        graph.textAlign = 'center';
        graph.fillStyle = '#FFFFFF';
        graph.font = 'bold 30px sans-serif';
        if (global.kicked) {
            if (reason !== '') {
                graph.fillText('You were kicked for:', global.screenWidth / 2, global.screenHeight / 2 - 20);
                graph.fillText(reason, global.screenWidth / 2, global.screenHeight / 2 + 20);
            }
            else {
                graph.fillText('You were kicked!', global.screenWidth / 2, global.screenHeight / 2);
            }
        }
        else {
              graph.fillText('Disconnected!', global.screenWidth / 2, global.screenHeight / 2);
        }
    }
}