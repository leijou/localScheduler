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

All task launchers (`.local`,`.broadcast`,`.run`) accept the task name, the
delay (milliseconds) before running, and an array of arguments to pass to the
task. Arguments must be JSON serializable to be transfered over localStorage.

More
----
All task launchers (`.local`,`.broadcast`,`.run`) return a string which can be
given to `.cancel` to cancel the task on all tabs.

There is also the `.disconnect` function to stop the current tab service
requests for localScheduler.

Notes
-----
Please consider this library as experimental for now as there may be some small
bugs and garbage collection parts missing. Specifically the `.run` method may
run in more than one tab in Chrome when using separate windows due to what I
believe is a bug in their localStorage implementation.
