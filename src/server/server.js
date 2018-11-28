/*jslint bitwise: true, node: true */
'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var sql = require ("mysql");

// Import game settings.
var c = require('../../config.json');

// Import utilities.
var util = require('./lib/util');

//call sqlinfo
var s = c.sqlinfo;

var grid = [];
var users = [];
var sockets = {};
var playersTurn = 0;

if(s.host !== "DEFAULT") {
    var pool = sql.createConnection({
        host: s.host,
        user: s.user,
        password: s.password,
        database: s.database
    });

    //log sql errors
    pool.connect(function(err){
        if (err){
            console.log (err);
        }
    });
}

app.use(express.static(__dirname + '/../client'));

io.on('connection', function (socket) {
	console.log('A user connected!', socket.handshake.query.type);

	var currentPlayer = {
		id: socket.id,
		hue: Math.round(Math.random() * 360),
		lastHeartbeat: new Date().getTime(),
		index: 0,
		nextShapes: []
	};

	socket.on('gotit', function (player) {
		console.log('[INFO] Player ' + player.name + ' connecting!');

		if (util.findIndex(users, player.id) > -1) {
			console.log('[INFO] Player ID is already connected, kicking.');
			socket.disconnect();
		} else if (!util.validNick(player.name)) {
			socket.emit('kick', 'Invalid username.');
			socket.disconnect();
		} else {
			console.log('[INFO] Player ' + player.name + ' connected!');
			sockets[player.id] = socket;

			player.hue = Math.round((Math.random() * 360) / 20) * 20; // force 20 point increments
			currentPlayer = player;
			currentPlayer.lastHeartbeat = new Date().getTime();
			currentPlayer.index = users.length;
			users.push(currentPlayer);

			if( users.length == c.playerCount ) {
				io.emit('startGame', {playersTurn: users[playersTurn]});
			}

			io.emit('playerJoin', {name: currentPlayer.name});

			setUpGame(c.playerCount);
			console.log('Total players: ' + users.length);
		}

	});

	socket.on('pingcheck', function () {
		socket.emit('pongcheck');
	});

	socket.on('join', function () {
		if (util.findIndex(users, currentPlayer.id) > -1)
			users.splice(util.findIndex(users, currentPlayer.id), 1);

		socket.emit('welcome', currentPlayer);
		console.log('[INFO] User ' + currentPlayer.name + ' respawned!');
	});

	socket.on('disconnect', function () {
		if (util.findIndex(users, currentPlayer.id) > -1)
			users.splice(util.findIndex(users, currentPlayer.id), 1);

		console.log('[INFO] User ' + currentPlayer.name + ' disconnected!');

		socket.broadcast.emit('playerDisconnect', {name: currentPlayer.name});
	});

	// Heartbeat function, update everytime.
	socket.on('0', function (target) {
		currentPlayer.lastHeartbeat = new Date().getTime();
	});

	socket.on('movement', function(data) {
		//console.log(data);

		var user = users.find((x => x.id == socket.id));
		if( user && user.nextShapes && user.nextShapes.length > 0 ) {

			// reset possible
			var gs = grid.filter((x) => x.possiblePlayer && x.possiblePlayer.id == user.id);
			if (gs) {
				gs.forEach((g) => g.possiblePlayer = null);
			}

			// figure out which tiles this user can place their shape
			var cell = {
				col: Math.max(0, Math.min(c.gameWidth - 1, Math.ceil(c.gameWidth * data.x) - 1)),
				row: Math.max(0, Math.min(c.gameHeight - 1, Math.ceil(c.gameHeight * data.y) - 1))
			};

			// var g = grid.find((x) => x.row == cell.row && x.col == cell.col && ((!x.lockedPlayer && x.startingPlayer && x.startingPlayer.id == user.id) || (x.lockedPlayer && x.lockedPlayer.id == user.id)));
			// // check that they are next to a cell they already own
			//
			// // top
			// if (cell.row > 0 && !g) {
			// 	g = grid.find((x) => x.row == cell.row - 1 && x.col == cell.col && x.lockedPlayer && x.lockedPlayer.id == user.id);
			// }
			// // right
			// if (cell.col < c.gameWidth && !g) {
			// 	g = grid.find((x) => x.row == cell.row && x.col == cell.col + 1 && x.lockedPlayer && x.lockedPlayer.id == user.id);
			// }
			//
			// // bottom
			// if (cell.row < c.gameHeight && !g) {
			// 	g = grid.find((x) => x.row == cell.row + 1 && x.col == cell.col && x.lockedPlayer && x.lockedPlayer.id == user.id);
			// }
			//
			// // left
			// if (cell.col > 0 && !g) {
			// 	g = grid.find((x) => x.row == cell.row && x.col == cell.col - 1 && x.lockedPlayer && x.lockedPlayer.id == user.id);
			// }
			//
			// if (g) {
				const coords = {x: cell.row, y: cell.col};
				const shape = user.nextShapes[0];

				let canMove = true;
				let shapeGrids = [];
				// build the shape. Check all directions

				// shapeGrids = grid.filter((x) => !x.lockedPlayer && x.row >= coords.x && x.row < coords.x+shape.h && x.col >= coords.y && x.col < coords.y+shape.w); //down-to-right
				// if( shapeGrids.length == 0 ) shapeGrids = grid.filter((x) => !x.lockedPlayer && x.row >= coords.x && x.row < coords.x+shape.h && x.col <= coords.y && x.col > coords.y-shape.w); //down-to-left
				// if( shapeGrids.length == 0 ) shapeGrids = grid.filter((x) => !x.lockedPlayer && x.row <= coords.x && x.row > coords.x-shape.h && x.col >= coords.y && x.col < coords.y+shape.w); //up-to-right
				// if( shapeGrids.length == 0 ) shapeGrids = grid.filter((x) => !x.lockedPlayer && x.row <= coords.x && x.row > coords.x-shape.h && x.col <= coords.y && x.col > coords.y-shape.w); //up-to-left

				// shift the shape so it's centered on the mouse
				const shift = {w:0, h:0};
				do {
					const u = user;
					for (let i = -shift.h; i < shape.h - shift.h; i++) { // down-to-right
						const ii = i;
						for (let j = -shift.w; j < shape.w - shift.w; j++) {
							const jj = j;
							let fg = grid.find((x) => x.row == coords.x + ii && x.col == coords.y + jj && !x.lockedPlayer);
							if (fg) {
								shapeGrids.push(fg);
							} else {
								canMove = false;
							}
						}
					}
					if (!canMove) {
						canMove = true;
						shapeGrids = [];
						for (let i = -shift.h; i < shape.h - shift.h; i++) { // down-to-left
							const ii = i;
							for (let j = -shift.w; j < shape.w - shift.w; j++) {
								const jj = j;
								let fg = grid.find((x) => x.row == coords.x + ii && x.col == coords.y - jj && !x.lockedPlayer);
								if (fg) {
									shapeGrids.push(fg);
								} else {
									canMove = false;
								}
							}
						}
					}
					if (!canMove) {
						canMove = true;
						shapeGrids = [];
						for (let i = -shift.h; i < shape.h - shift.h; i++) { // up-to-right
							const ii = i;
							for (let j = -shift.w; j < shape.w - shift.w; j++) {
								const jj = j;
								let fg = grid.find((x) => x.row == coords.x - ii && x.col == coords.y + jj && !x.lockedPlayer);
								if (fg) {
									shapeGrids.push(fg);
								} else {
									canMove = false;
								}
							}
						}
					}
					if (!canMove) {
						canMove = true;
						shapeGrids = [];
						for (let i = -shift.h; i < shape.h - shift.h; i++) { // up-to-left
							const ii = i;
							for (let j = -shift.w; j < shape.w - shift.w; j++) {
								const jj = j;
								let fg = grid.find((x) => x.row == coords.x - ii && x.col == coords.y - jj && !x.lockedPlayer);
								if (fg) {
									shapeGrids.push(fg);
								} else {
									canMove = false;
								}
							}
						}
					}

					if ( canMove ) {

						// check if the shape is next to a square the user has or contains the starting position
						const minRow = shapeGrids.map(x => x.row).reduce((prev, curr) =>  Math.min(prev, curr));
						const maxRow = shapeGrids.map(x => x.row).reduce((prev, curr) => Math.max(prev, curr));
						const minCol = shapeGrids.map(x => x.col).reduce((prev, curr) =>  Math.min(prev, curr));
						const maxCol = shapeGrids.map(x => x.col).reduce((prev, curr) =>  Math.max(prev, curr));

						const g = grid.find((x) => (
							(x.row == minRow - 1 && x.col >= minCol && x.col <= maxCol && x.lockedPlayer && x.lockedPlayer.id == u.id) || // above
							(x.row == maxRow + 1 && x.col >= minCol && x.col <= maxCol && x.lockedPlayer && x.lockedPlayer.id == u.id) || // bottom
							(x.col == minCol - 1 && x.row >= minRow && x.row <= maxRow && x.lockedPlayer && x.lockedPlayer.id == u.id) || // left
							(x.col == maxCol + 1 && x.row >= minRow && x.row <= maxRow && x.lockedPlayer && x.lockedPlayer.id == u.id) || // right
							(x.row >= minRow && x.row <= maxRow && x.col >= minCol && x.col <= maxCol && x.startingPlayer && x.startingPlayer.id == u.id)  // contains starting position
						));

						if( g ) {
							shapeGrids.forEach((x) => x.possiblePlayer = u);
							u.canPlaceShape = true;
							break;
						} else {
							u.canPlaceShape = false;
							shapeGrids = [];
						}
					} else {
						// no more moves?
						u.canPlaceShape = false;
						shapeGrids = [];
					}
					if( shift.w < shape.w ) shift.w++; else shift.h++;
				} while ( shift.w < shape.h-1 && shift.h < shape.h-1 );
			//}
		}
	});

	socket.on('clicked-canvas', function(){

		let user = users.find((x => x.id == socket.id));
		console.log('clicked', user);
		if( user && user.canPlaceShape ) {

			let possibleGrids = grid.filter((x) => x.possiblePlayer && x.possiblePlayer.id == user.id);
			possibleGrids.forEach((g) => {
				g.lockedPlayer = user;
				g.possiblePlayer = null;
			});

			user.nextShapes.pop();
		}

	});

	socket.on('next-shape', function() {
		if( c.playerCount == 4 ) {
			var shape = {w:0, h:0};
			shape.w = Math.round(Math.random() * 5) + 1;
			shape.h = Math.round(Math.random() * 5) + 1;

			console.log('shape', shape);
			var user = users.find((x => x.id == socket.id));
			if( user ) {
				user.nextShapes.push(shape);
			}
		}
	});

	socket.on('rotate-shape', function() {

		let user = users.find((x => x.id == socket.id));
		if( user && user.nextShapes && user.nextShapes.length > 0 ) {
			const shape = user.nextShapes[0];
			user.nextShapes[0] = {w:shape.h, h:shape.w};
		}
	});
});

function setUpGame(type) {

	grid = [];
	for( let i = 0; i<c.gameHeight; i++ ) {
		for( let j = 0; j<c.gameWidth; j++ ) {

			let g = {
				type: type,
				row: i,
				col: j,
				possiblePlayer: null,
				lockedPlayer: null,
				startingPlayer: null,
			};

			if( i == 0 && j == 0 ) {
				g.startingPlayer = users.find(x => x.index == 0);
			} else if( i == c.gameHeight-1 && j == 0 ) {
				g.startingPlayer = users.find(x => x.index == 1);
			} else if( i == 0 && j == c.gameWidth - 1) {
				g.startingPlayer = users.find(x => x.index == 2);
			} else if( i == c.gameHeight-1 && j == c.gameWidth - 1) {
				g.startingPlayer = users.find(x => x.index == 3);
			}

			grid.push(g);

		}
	}

	//console.log(grid.find(x => x.row == 0 && x.col == 0 ), grid.find(x => x.row == 39 && x.col == 0));
	//console.log(grid.find(x => x.row ==0 && x.col == 39 ), grid.find(x => x.row == 39 && x.col == 39));
	io.sockets.emit('gameSetup', {width: c.gameWidth, height: c.gameHeight});
}

function tickPlayer(currentPlayer) {
    if(currentPlayer.lastHeartbeat < new Date().getTime() - c.maxHeartbeatInterval) {
        sockets[currentPlayer.id].emit('kick', 'Last heartbeat received over ' + c.maxHeartbeatInterval + ' ago.');
        sockets[currentPlayer.id].disconnect();
    }
}

function moveloop() {
    for (var i = 0; i < users.length; i++) {
        tickPlayer(users[i]);
    }
}


function sendUpdates() {
	io.sockets.emit('state', {grid:grid, users:users});
}

setInterval(moveloop, 1000 / 60);
setInterval(sendUpdates, 1000 / c.networkUpdateFactor);

// Don't touch, IP configurations.
var ipaddress = process.env.OPENSHIFT_NODEJS_IP || process.env.IP || c.host;
var serverport = process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || c.port;
http.listen( serverport, ipaddress, function() {
    console.log('[DEBUG] Listening on ' + ipaddress + ':' + serverport);
});
