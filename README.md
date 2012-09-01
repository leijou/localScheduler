localScheduler
==============

A Javascript library to schedule the launching and communication of functions
between tabs/windows.

Uses localStorage to store a queue of tasks to run after a given delay, even if
the original tab is closed.

Usage
-----

```javascript
var scheduler = localScheduler.getNamespace('example');

scheduler.register('test', function (message) {
	var div = document.createElement('div');
    div.innerHTML = message;
    document.body.appendChild(div);
});

scheduler.connect();

scheduler.local('test', 500, ["Function run on this tab only"]);

scheduler.broadcast('test', 1000, ["Function run on all open tabs when delay expires"]);
```


To-do list
----------
1. Add locking option so that only one tab runs the scheduled function
2. Add interval option to repeatedly launch a worker
