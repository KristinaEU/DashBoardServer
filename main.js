
// Kristina server
// ps -e | grep nodejs
// nohup nodejs main.js &

// Functionalities
// 1. Websockets to web app
// 2. HTTP for display info
// 3. REST server to receive data and forward to web app through websocket
// 4. REST client to recieve data from websocket and forward to URI

const PORTHTTP = 8008;


// Websocket + REST + HTTP
var WebSocket = require('ws').Server;
var http = require('https');
var express = require('express');
var RESTapp = express();
var fs = require('fs');
var path = require('path');
var options = {
  key: fs.readFileSync('cert/ec2-52-29-254-9.key'),
  cert: fs.readFileSync('cert/ec2-52-29-254-9.crt')
};

var server = http.createServer(options, RESTapp);



var bodyParser = require('body-parser');
require('body-parser-xml')(bodyParser);



RESTapp.use(bodyParser.urlencoded({limit: '2mb', extended: false }));
RESTapp.use(bodyParser.json({limit: '2mb'}));
// https://github.com/Leonidas-from-XIV/node-xml2js#options
RESTapp.use(bodyParser.xml({
	xmlParseOptions: {
		strict:false,
		mergeAttrs: true,
		normalizeTags: true,
		explicitArray: false
	}
}));



RESTapp.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


RESTapp.post('/event', function(req, res, next){
	
	res.setHeader("Content-Type","application/json");
 	
	var id = req.body.meta.avatar;

	console.log("Event to: " + id + "--->" + JSON.stringify(req.body));

	req.body.data.id = req.body.uuid;
	
	writeToWS(id, JSON.stringify(req.body.data), res, req.body.uuid);

	if (req.body.uuid === undefined)
		res.send("{ok:true}");

});


RESTapp.get('/', function(req, res, next){
	res.sendFile(path.join(__dirname + '/index.html'));
});


// Websocket server
var wss = new WebSocket({server:server});
// Websocket clients
var numClients = 0;
var clients = [];

wss.on('connection', function(ws){

	console.log("New WebSocket connection.");

	// Create response buffer
	ws.res = {};


	// New message arrives
	ws.on('message', function(data, flags){
		console.log("Received: " + data);
		// Init connection
		if (!this.id){
			// Random id
			if (data == "--random--" || data == "")
				this.id = numClients++;
			// Login id
			else
				this.id = data.toLowerCase();

			// Add ws to clients list
			clients.push(this);
			// Confirm and send id to websocket
			var idObj = {};
			idObj.clientId = this.id;
			this.send(JSON.stringify(idObj));
			// Send new id to VSM?
			console.log("New client with id: " + this.id);

		} else{
			// Send REST response to VSM
			if (this.res.length != 0){
				var cmdId = data.split(":")[0];

				// If cmdId exists
				if (this.res[cmdId]){
					this.res[cmdId].send("{"+data+"}");//JSON response
					delete this.res[cmdId];
					console.log("Sending: " + data);
				}
			} else
			// Discard message
			console.log("Message from WS discarded (response from REST was already answered: " + data);
		}
	});


	// Connection closed
	ws.on('close', function(){

		console.log("Connection closed.");
		// Remove from clients list
		var index = clients.indexOf(this);
		if (index != -1){
			// Alert VSM that client has disconnected
			console.log("VSM, client has gone!");
			// Delete client from server
			clients.splice(index, 1);

			console.log("Client gone: " + this.id);
		}

	});



});



writeToWS = function(id, data, res, cmdId){
	
	if (clients.length != 0){
		// Should analyse for who is the message
		// Check if any client id matches to id
		var WSclient = clients.filter(function(obj){
			if ('id' in obj && obj.id == id){
				return obj;
			} else
				console.log("Websocket client not found");
		});

		// If clients found
		if(WSclient.length != 0)
			// Send data with clients with idem id
			for (var i = 0; i<WSclient.length; i++){
				WSclient[i].send(data);
				// Assign response. If client is in two devices, only assing one res
				if (res && cmdId && i == 0){
					WSclient[i].res[cmdId] = res;	
					console.log("Response stored with id: " + cmdId);
				}
			}
			
		else{
			res.send("Error: client doesn't exist!" + id);
			console.log("Client doesn't exist: " + id);
		}
		

	} else{
		if(res)
			res.send("Error: there are no clients!");
		console.log("There are no clients.");
	}
}

server.listen(PORTHTTP);
console.log("\n\n**********  Running on :", PORTHTTP, ".");

// Server log
console.logCopy = console.log.bind(console);
var serverLog = [];
console.log = function(data){
	var date = new Date().toUTCString();
	// Output (comment if you dont want comments)
	//this.logCopy(date + ": " + data);

	serverLog.push(data);
	if (serverLog.length > 50) // Number of logs
		serverLog.shift();
}


