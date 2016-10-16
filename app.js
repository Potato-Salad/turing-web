/*

  There are some minor modifications to the default Express setup
  Each is commented and marked with [SH] to make them easy to find

 */

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
// [SH] Require Passport
var passport = require('passport');


// Lobby material
var tls = require('tls'),
    fs          = require('fs'),
    url         = require('url'),
    app         = express(),
    fs          = require('fs'),
    port        = process.env.PORT || 4000;



// [SH] Bring in the data model
require('./app_api/models/db');
// [SH] Bring in the Passport config after model is defined
require('./app_api/config/passport');


// [SH] Bring in the routes for the API (delete the default routes)
var routesApi = require('./app_api/routes/index');

var app = express();


var fs = require('fs')



// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// [SH] Set the app_client folder to serve static resources
app.use(express.static(path.join(__dirname, 'app_client')));

// [SH] Initialise Passport before using the route middleware
app.use(passport.initialize());

// [SH] Use the API routes when path starts with /api
app.use('/api', routesApi);

// [SH] Otherwise render the index.html page for the Angular SPA
// [SH] This means we don't have to map all of the SPA routes in Express
app.use(function(req, res) {
  res.sendFile(path.join(__dirname, 'app_client', 'index.html'));
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// [SH] Catch unauthorised errors
app.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    res.status(401);
    res.json({"message" : err.name + ": " + err.message});
  }
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});



var http        = require('http').Server(app),
    io          = require('socket.io')();

// attach http to the io socket
io.attach(http);

http.listen(port,function(){
    console.log('Express HTTP server listening on port %d',port);
});

// https.listen(sslPort, function(){
//   console.log("Express HTTPS server listening on port " + sslPort);
// });

// parse application/x-www-form-urlencoded
// app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({extended:true}));

// Routing
app.use(express.static(__dirname + '/public'));

// send a message view POST
app.post('/push',function(req, res){

    // console.log("[200] " + req.method + " to " + req.url);

    try{
        // if post to lobby or global
        if (req.body.lobby)
            io.sockets.to(req.body.lobby).emit('new message',{message:req.body.message,username:'server'});
        else
            io.sockets.emit('new message',{message:req.body.message,username:'server'});
        res.json({'success':true});
    }
    catch(e){
        res.json({'success':false});
    }

});

// return array of users connected
app.get('/get-users',function(req,res){
    var users = [];
    for (var key in io.sockets.adapter.sids ){
        var connectedClient = io.sockets.connected[key],
            returnClient    = {'id':connectedClient.conn.id,'rooms':[],'username':connectedClient.username};
            console.log("Connected client: " + connectedClient);
        for (var room in connectedClient.rooms){
            if (connectedClient.rooms[room] !== returnClient.id)
                returnClient.rooms.push(connectedClient.rooms[room]);
        }
        users.push(returnClient);
    }
    res.json(users);
});

// Chatroom

// usernames userids and count
var usernames       = {},
    userids         = {},
    numUsers        = {};


io.on('connection',function(socket){

    var lobby     = url.parse(socket.handshake.url, true).query.lobby,
        addedUser   = false;

    if (!numUsers[lobby])
        numUsers[lobby] = 0;
    if (!usernames[lobby])
        usernames[lobby] = {};
    if (!userids[lobby])
        userids[lobby] = {};

    socket.join(lobby);

    // when the client emits 'new message'
    socket.on('new message',function(data){
        // emit the message to the other subscribers
        if (socket.username === data.username){
        socket.broadcast.to(lobby).emit('new message',{
            username    : socket.username,
            message     : data
        });} else{
        socket.broadcast.to(lobby).emit('new message',{
            username    : "anonymous",
            message     : data
        });

        //bots response

        var prob = 1/numUsers[lobby];
        var response = "";
        console.log(data);
        if(Math.random <= prob){
            response = respond(data,0);
        };
        console.log(response);
        socket.broadcast.to(lobby).emit('new message',{
            username    : "anonymous",
            message     :  response
        });
    };
    });

    // when client emits add user
    socket.on('add user',function(username){
        // we store the user in the socket session for this client
        socket.username = username;
        // add the client's username to the global list
        if(Object.keys(usernames[lobby]).indexOf(username) === -1){
            usernames[lobby][username] = username;
            userids[lobby][numUsers] = numUsers[lobby];
            ++numUsers[lobby];
            addedUser = true;
            socket.emit('login',{
                numUsers        : numUsers[lobby],
                participants    : usernames[lobby]
            });
            // echo globally (all clients) that a person has connected
            socket.broadcast.to(lobby).emit('user joined',{
                username : "anonymous",
                numUsers : numUsers[lobby]
            });
        } else {
            socket.emit('bad-login');
        }
    });

    // when client emits typing
    socket.on('typing',function(){
        socket.broadcast.to(lobby).emit('typing',{
            username:"anonymous"
        });
    });

    // when client emits stop typing
    socket.on('stop typing',function(){
        socket.broadcast.to(lobby).emit('stop typing',{
            username:"anonymous"
        });
    });

    socket.on('button clicked', function(){
        socket.broadcast.to(lobby).emit('button clicked',{
            message:"reported"
        });
    });

    // when the user disconnects
    socket.on('disconnect', function(){
        // remove the username
        if (addedUser){
            delete usernames[lobby][socket.username];
            delete userids[lobby][numUsers]
            --numUsers[lobby];
            // echo globally that the client left
            socket.broadcast.to(lobby).emit('user left',{
                username : "anonymous",
                numUsers : numUsers[lobby]
            });
        }
    });
});



module.exports = app;
