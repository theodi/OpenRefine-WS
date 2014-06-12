/*
 * Firewall control for OpenRefine-WS
 * ==================================
 * 
 * Copyright: The Open Data Institute 2013
 * License: MIT 
 * 
 * This script manipulates a ubuntu firewall via UFW to control who has access to the OpenRefine servers
 * 
 * Note: This must be run as root, which is why it is separate to the OpenRefine-WS server itself!
 *
 */

var fs = require('fs')
  , util = require('util')
  , sys = require('sys')
  , exec = require('child_process').exec
;

allowToPort("80","any");
console.log("Firewall control ready");

fs.watchFile('servers.json', 
	function(ev,file) {
		processChange();
	}
);

function processChange() {	
	var servers = loadServerData();
	for (var i = 0; i<servers.length; i++) {
		server = servers[i];
		// Find a port to run a server on
		if (server.ip != "" && server.user != "") {
			allowToPort(server.port, server.ip);
		} else {
			denyToPort(server.port);
		}
	}	
}

function allowToPort(port, ip) {
	var child = exec("ufw delete deny from any to any port " + port,
		function (error, stdout, strerr) {
			var child = exec("ufw allow from " + ip + " to any port " + port,
				function (error, stdout, strerr) {
				}
			);
		}
	);
}

function denyToPort(port) {
	var child = exec("ufw deny from any to any port " + port,
		function (error, stdout, strerr) {
		}
	);
}

function loadServerData() {
	var data = fs.readFileSync('./servers.json'), servers;
	try {
		servers = JSON.parse(data);
	} catch (err) {
		console.log('\n\nCould not read config file for servers\n\n');
		console.log(err.message);
		return false;
	}
	return servers;
}
