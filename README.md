localScheduler
==============

A Javascript library to schedule the launching and communication of functions
between tabs/windows.

Uses localStorage to store a queue of tasks to run after a given delay, even if
the original tab is closed.

Usage
-----
The localScheduler file must be included in the document, no other files or
libraries are required

`<script src="localscheduler.js"></script>`

```javascript
// Get the localScheduler object
var scheduler = localScheduler.getNamespace('example');

// Register functions against task names
scheduler.register('test', function (message) {
	var div = document.createElement('div');
    div.innerHTML = message;
    document.body.appendChild(div);
});

// Connect to the localScheduler session over localStorage
// If tasks are currently queued this will pick them up
// For this reason you should register your tasks before connecting
scheduler.connect();

// .local runs the task in the local tab only when the delay expires
scheduler.local('test', 500, ["Function run on this tab only"]);

// .broadcast runs the task in all tab that are connected when the delay expires
scheduler.broadcast('test', 1000, ["Function run on all open tabs when delay expires"]);

// .run runs the task in one tab that is connected when the delay expires
scheduler.run('test', 1000, ["Function run on only one open tab when delay expires"]);
```

Set Interval
------------
A handy use of localScheduler is running a regular task once over all tabs.
This can be done using `.run` and the special `_startup` task. Resulting data
can be shared to all tabs using `.broadcast`.

`_startup` will only be run on the first tab opened and if no tasks are
currently queued.

```javascript
var scheduler = localScheduler.getNamespace('interval');

scheduler.register('_startup', function () {
	// All tasks are run in the namespace's scope, so you can use this to reference it
	this.run('random', 1000);
});
scheduler.register('random', function () {
	this.broadcast('message', 0, [Math.floor(Math.random()*1000)]);
	this.run('random', 1000);
});
scheduler.register('message', function (msg) {
	var div = document.createElement('div');
    div.innerHTML = msg;
    document.body.appendChild(div);
});

scheduler.connect();
```

More
----
All task launchers (`.local`,`.broadcast`,`.run`) return a string which can be
given to `.cancel` to cancel the task on all tabs.

There is also the `.disconnect` function to stop the current tab service
requests for localScheduler.
