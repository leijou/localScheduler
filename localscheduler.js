/**
 * localScheduler
 * 
 * @author Stephen Hawkes
 * @link https://github.com/leijou
 */

var localScheduler = {
	PREFIX: 'localScheduler.',
	CANCELTASK: 'LSCANCEL',
	connections: {},
	localid: null
};

/**
 * Initiate localScheduler. Called at end of this file
 * @private
 */
localScheduler.main = function () {
	localScheduler.localid = localScheduler.randomId();
	localScheduler.connections = {};

	if (window.addEventListener) {
		window.addEventListener("storage", localScheduler.changeEvent, false);
	} else {
		window.attachEvent("onstorage", localScheduler.changeEvent);
	}
}

/**
 * Return the current time in milliseconds since the epoch
 * @protected
 */
localScheduler.now = function () {
	return (new Date()).getTime();
}

/**
 * Return a hopefully unique alphanumeric string. Usually around 29 chars long
 * @protected
 */
localScheduler.randomId = function () {
	return localScheduler.now().toString(36) +
	       Math.floor(Math.random()*10000000000000000).toString(36) +
	       Math.floor(Math.random()*10000000000000000).toString(36);
}

/**
 * Pass localStorage change events to the associated localScheduler connections
 * @private
 */
localScheduler.changeEvent = function (e) {
	if (e.key.substr(0, localScheduler.PREFIX.length) == localScheduler.PREFIX) {
		for (i in localScheduler.connections) {
			if (e.key.substr(localScheduler.PREFIX.length, i.length+1) == i + '.') {
				localScheduler.connections[i].changeEvent(e);
				return;
			}
		}
	}
}

/**
 * Constructor of the main localScheduler object
 * @constructor
 */
localScheduler.getNamespace = function (namespaceid) {
	
	// Maintain only one connection per namespace per tab
	if (namespaceid in localScheduler.connections) {
		return localScheduler.connections[namespaceid];
	}
	
	// Create new object for this connection
	var scope = {};
	scope.PREFIX = localScheduler.PREFIX + namespaceid + '.';
	scope.namespace = namespaceid;
	scope.connected = false;
	scope.localtasks = {};
	scope.workers = {};
	
	
	
	/**
	 * Register a worker function
	 * @public
	 */
	scope.register = function (workerid, func) {
		scope.workers[workerid] = func;
	}
	
	/**
	 * Connect to the worker scheduler and queue any outstanding tasks
	 * @public
	 */
	scope.connect = function () {
		if (scope.connected) return;
		
		scope.connected = true;
		scope.launchtime = localScheduler.now();
		
		// Store all namespace connections in a collection pool
		// This also allows storage events to be passed through
		localScheduler.connections[scope.namespace] = scope;
		
		// Scan for existing tasks that are still queued to run
		// Also take note of expired tasks for cleanup if this is the first tab
		var hastasks = false;
		var pasttasks = [];
		for (i in localStorage) {
			if (
				(localStorage[i]) &&
				(localStorage[i] != localScheduler.CANCELTASK) &&
				(i.substr(0, scope.PREFIX.length) == scope.PREFIX)
			) {
				var path = i.substr(scope.PREFIX.length).split('.');
				switch (path[0]) {
					case 'task':
						var task = JSON.parse(localStorage[i]);
						if ( (task) && (task.time) ) {
							if (task.time >= scope.launchtime) {
								scope.acceptTask(path[1], localStorage[i]);
								hastasks = true;
							} else {
								pasttasks.push(i);
							}
						}
						break;
				}
			}
		}
		
		// Add a task for other tabs to run, to see if anyone else is there
		var pid = localScheduler.randomId();
		localStorage[scope.PREFIX+'task.'+pid] = JSON.stringify({
			'worker': '_connect',
			'time': scope.launchtime,
			'args': []
		});
		pasttasks.push(scope.PREFIX+'task.'+pid);
		
		// Check expired tasks to determine if this is the first tab
		setTimeout(function () {
			var hit = false;
			for (var i=0; i<pasttasks.length; i++) {
				if (localStorage[pasttasks[i]]) {
					delete localStorage[pasttasks[i]];
					hit = true;
				}
			}
			if ( (hit) && (!hastasks) ) {
				scope.callWorker('_startup', []);
			}
		}, 500);
		
	}
	
	/**
	 * Disconnect from the worker scheduler and stop serving task requests
	 * @public
	 */
	scope.disconnect = function () {
		delete localScheduler.connections[namespaceid];
		
		for (i in scope.localtasks) {
			clearTimeout(scope.localtasks[i].timeout);
		}
		scope.localtasks = {};
		
		scope.connected = false;
	}
	
	/**
	 * Run a worker in the current tab after a delay
	 * @public
	 */
	scope.local = function (worker, delay, args) {
		delay = parseInt(delay) | 0;
		var pid = localScheduler.randomId();
		var timeout = setTimeout(function () {
			scope.startTask(pid);
		}, delay);
		scope.localtasks[pid] = {
			'worker': worker,
			'args': args,
			'timeout': timeout,
			'lock': false
		};
		return pid;
	}
	
	/**
	 * Run a worker in all tabs after a delay
	 * @public
	 */
	scope.broadcast = function (worker, delay, args, lock) {
		delay = parseInt(delay) | 0;
		lock = lock ? true : false;
		var pid = scope.local(worker, delay, args, lock);
		localStorage[scope.PREFIX+'task.'+pid] = JSON.stringify({
			'worker': worker,
			'time': localScheduler.now() + Math.max(0, delay),
			'args': args,
			'lock': lock
		});
		return pid;
	}
	
	/**
	 * Run a worker one tab after a delay
	 * @public
	 */
	scope.run = function (worker, delay, args) {
		return scope.broadcast(worker, delay, args, true);
	}
	
	/**
	 * Cancel a task being run on any tab
	 * @public
	 */
	scope.cancel = function (pid) {
		scope.rejectTask(pid);
		localStorage[scope.PREFIX+'task.'+pid] = localScheduler.CANCELTASK;
		delete localStorage[scope.PREFIX+'task.'+pid];
	}
	
	/**
	 * @private
	 */
	scope.changeEvent = function (e) {
		var path = e.key.substr(scope.PREFIX.length).split('.');
		if (path[0] == 'task') {
			// Queue new tasks, remove tasks that have been cancelled, and
			// ignore everything else (assume garbage collection)
			if (e.newValue == localScheduler.CANCELTASK) {
				scope.rejectTask(path[1]);
			} else if (e.oldValue == null) {
				scope.acceptTask(path[1], e.newValue);
			}
		}
	}
	
	/**
	 * @private
	 */
	scope.acceptTask = function (pid, value) {
		scope.localtasks[pid] = JSON.parse(value);
		scope.localtasks[pid].timeout = setTimeout(function () {
			scope.startTask(pid);
		}, Math.max(scope.localtasks[pid].time - localScheduler.now(), 0));
	}
	
	/**
	 * @private
	 */
	scope.rejectTask = function (pid) {
		if (pid in scope.localtasks) {
			clearTimeout(scope.localtasks[pid].timeout);
			delete scope.localtasks[pid];
		}
	}
	
	/**
	 * @private
	 */
	scope.startTask = function (pid) {
		var task = scope.localtasks[pid];
		if (!task) return;
		
		if (task.lock) {
			scope.lockTask(pid, task);
		} else {
			scope.callWorker(task.worker, task.args);
			
			// Clear from localstorage
			delete localStorage[scope.PREFIX+'task.'+pid];
			// Clear from pending task list
			delete scope.localtasks[pid];
		}
	}
	
	/**
	 * Compete with all tabs to see who runs a single-run task
	 * @private
	 */
	scope.lockTask = function (pid, task) {
		var x = scope.PREFIX+'lock.'+pid+'.x';
		var y = scope.PREFIX+'lock.'+pid+'.y';
		var z = scope.PREFIX+'task.'+pid;
		
		// Locking algorithm based on fast mutex and
		// http://balpha.de/2012/03/javascript-concurrency-and-locking-the-html5-localstorage/
		// 
		// setTimeouts required so that Javascript re-queries localStorage correctly
		
		if (!localStorage[z]) return scope.lockTaskCancel(pid);
		
		localStorage[x] = localScheduler.localid;
		setTimeout(function () {
			if (localStorage[y]) return scope.lockTaskCancel(pid);
			localStorage[y] = localScheduler.localid;
			
			setTimeout(function () {
				if (localStorage[x] != localScheduler.localid) {
					setTimeout(function () {
						if (localStorage[y] != localScheduler.localid) {
							return scope.lockTaskCancel(pid);
						}
						scope.lockTaskComplete(pid, task, x,y,z);
					}, 0);
				} else {
					scope.lockTaskComplete(pid, task, x,y,z);
				}
			}, 0);
		}, 0);
	}
	
	/**
	 * Called when tab gets the lock on a task
	 * @private
	 */
	scope.lockTaskComplete = function (pid, task, x,y,z) {
		if (!localStorage[z]) return scope.lockTaskCancel(pid);
		
		delete localStorage[z];
		
		scope.callWorker(task.worker, task.args);
		
		setTimeout(function () {
			delete localStorage[x];
			delete localStorage[y];
		}, 20);
	}
	
	/**
	 * Called when tab fails to get the lock on a task
	 * @private
	 */
	scope.lockTaskCancel = function (pid, task) {
		delete scope.localtasks[pid];
	}
	
	/**
	 * @private
	 */
	scope.callWorker = function (worker, args) {
		if (worker in scope.workers) {
			scope.workers[worker].apply(scope, args);
		}
	}
	
	return scope;
}


// Initiate localScheduler
localScheduler.main();
