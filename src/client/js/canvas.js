var global = require('./global');

class Canvas {
    constructor(params) {
		this.directionLock = false;
		this.target = global.target;
		this.socket = global.socket;
		this.directions = [];
		var self = this;

		this.canvasDragging = false;
		this.cv = document.getElementById(params.id);
		this.cv.width = global.screenWidth;
		this.cv.height = global.screenHeight;
		if (params.addEvents) {
			this.cv.addEventListener('mousemove', this.gameInput, false);
			this.cv.addEventListener('dragstart', this.canvasDrag, false);
			this.cv.addEventListener('mousedown', this.canvasClick, false);
			this.cv.addEventListener('mouseup', this.canvasLetGo, false);
			// this.cv.addEventListener('mouseout', this.outOfBounds, false);
			// this.cv.addEventListener('keypress', this.keyInput, false);
			// this.cv.addEventListener('keyup', function(event) {
			//     self.reenviar = true;
			//     self.directionUp(event);
			// }, false);
			// this.cv.addEventListener('keydown', this.directionDown, false);
			// this.cv.addEventListener('touchstart', this.touchInput, false);
			// this.cv.addEventListener('touchmove', this.touchInput, false);
		}
		this.cv.parent = self;
		global.canvas = this;
	}

    // Function called when a key is pressed, will change direction if arrow key.
    directionDown(event) {
    	var key = event.which || event.keyCode;
        var self = this.parent; // have to do this so we are not using the cv object
    	if (self.directional(key)) {
    		self.directionLock = true;
    		if (self.newDirection(key, self.directions, true)) {
    			self.updateTarget(self.directions);
    			self.socket.emit('0', self.target);
    		}
    	}
    }

    // Function called when a key is lifted, will change direction if arrow key.
    directionUp(event) {
    	var key = event.which || event.keyCode;
    	if (this.directional(key)) { // this == the actual class
    		if (this.newDirection(key, this.directions, false)) {
    			this.updateTarget(this.directions);
    			if (this.directions.length === 0) this.directionLock = false;
    			this.socket.emit('0', this.target);
    		}
    	}
    }

    // Updates the direction array including information about the new direction.
    newDirection(direction, list, isAddition) {
    	var result = false;
    	var found = false;
    	for (var i = 0, len = list.length; i < len; i++) {
    		if (list[i] == direction) {
    			found = true;
    			if (!isAddition) {
    				result = true;
    				// Removes the direction.
    				list.splice(i, 1);
    			}
    			break;
    		}
    	}
    	// Adds the direction.
    	if (isAddition && found === false) {
    		result = true;
    		list.push(direction);
    	}

    	return result;
    }

    // Updates the target according to the directions in the directions array.
    updateTarget(list) {
    	this.target = { x : 0, y: 0 };
    	var directionHorizontal = 0;
    	var directionVertical = 0;
    	for (var i = 0, len = list.length; i < len; i++) {
    		if (directionHorizontal === 0) {
    			if (list[i] == global.KEY_LEFT) directionHorizontal -= Number.MAX_VALUE;
    			else if (list[i] == global.KEY_RIGHT) directionHorizontal += Number.MAX_VALUE;
    		}
    		if (directionVertical === 0) {
    			if (list[i] == global.KEY_UP) directionVertical -= Number.MAX_VALUE;
    			else if (list[i] == global.KEY_DOWN) directionVertical += Number.MAX_VALUE;
    		}
    	}
    	this.target.x += directionHorizontal;
    	this.target.y += directionVertical;
        global.target = this.target;
    }

    directional(key) {
    	return this.horizontal(key) || this.vertical(key);
    }

    horizontal(key) {
    	return key == global.KEY_LEFT || key == global.KEY_RIGHT;
    }

    vertical(key) {
    	return key == global.KEY_DOWN || key == global.KEY_UP;
    }

    // Register when the mouse goes off the canvas.
    outOfBounds() {
        if (!global.continuity) {
            this.parent.target = { x : 0, y: 0 };
            global.target = this.parent.target;
        }
    }

    gameInput(mouse) {
		var bcr = this.getBoundingClientRect();
    	global.socket.emit('movement', {x: (mouse.clientX-bcr.left)/this.clientWidth, y: (mouse.clientY-bcr.top)/this.clientHeight});
    }

    touchInput(touch) {
        touch.preventDefault();
        touch.stopPropagation();
    	if (!this.directionLock) {
    		this.parent.target.x = touch.touches[0].clientX - this.width / 2;
    		this.parent.target.y = touch.touches[0].clientY - this.height / 2;
            global.target = this.parent.target;
    	}
    }

    // Chat command callback functions.
    keyInput(event) {
    	var key = event.which || event.keyCode;
    	if (key === global.KEY_FIREFOOD && this.parent.reenviar) {
            this.parent.socket.emit('1');
            this.parent.reenviar = false;
        }
        else if (key === global.KEY_SPLIT && this.parent.reenviar) {
            document.getElementById('split_cell').play();
            this.parent.socket.emit('2');
            this.parent.reenviar = false;
        }
        else if (key === global.KEY_CHAT) {
            document.getElementById('chatInput').focus();
        }
    }

    canvasDrag(event) {
    	console.log('dragging');
	}
	canvasClick(event) {
		global.socket.emit('clicked-canvas');
	}
	canvasLetGo(event) {
    	console.log('canvasLetGo');
		this.canvasDragging = false;
	}
}

module.exports = Canvas;
