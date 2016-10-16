var UI,
    chat    = {
        username        : '',
        connected       : false,
        reconnecting    : false,
        typing          : false,
        lastTypingTime  : null,
        participants    : {}
    },
    socket,
    counter = 0;

$(function () {

    var FADE_TIME           = 150,
        TYPING_TIMER_LENGTH = 400,
        COLORS              = [
            '#e21400', '#91580f', '#f8a700', '#f78b00',
            '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
            '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
        ],
        $window         = $(window);

        // setup UI
        UI              = {
            usernameInput   : $('.usernameInput'),
            messages        : $('.messages'),
            inputMessage    : $('.inputMessage'),
            participants    : $('#participants'),
            participantsPage: $('.participants.page'),
            loginPage       : $('.login.page'),
            chatPage        : $('.chat.page'),
            lobby           : $('#lobby'),
            participantCount: $('#participant_count')
        }
        UI.currentInput    = UI.usernameInput.focus();

        // states how many participants in room
        function addParticipantMessage(data) {
            doLog('addParticipantMessage', data);
            var message = '';

            message += data.numUsers  + ' participant' + (data.numUsers === 1 ? '' : 's');

            UI.participantCount.html(message);
        }

        // set the client's username
        function setUsername() {
            doLog('setUsername');
            // sanitize username
            chat.username = cleanInput(UI.usernameInput.val().trim());

            // if the username is valid
            if (chat.username) {
                // Tell the server your username
                socket.emit('add user', chat.username);
            }
        }

        // send chat message
        function sendMessage() {
            doLog('sendMessage');
            // sanitize message
            var message = cleanInput(UI.inputMessage.val());
            // if connected and content in message
            if (message && chat.connected) {
                UI.inputMessage.val('');
                addChatMessage({
                    username    : chat.username,
                    message     : message
                });
                // public mesage
                socket.emit('new message', message);
            }
        }

        // log message
        function log(message,options) {
            doLog('log',message,options);
            if (chat.connected === true && chat.reconnecting === false){
                var elem = $('<li>').addClass('log').text(message);
                addMessageElement(elem,options);
            }
        }

        // adds the  visual chat message
        function addChatMessage(data,options){
            doLog('addChatMessage',data,options);
            // don't fade the message in if there is an 'X was typing'
            var typingMessages = getTypingMessages(data);
            options = options || {};
            if (typingMessages.length !== 0){
                options.fade = false;
                typingMessages.remove();
            }
            if (data.username !== "anonymous"){
            var usernameDiv     = $('<span>')
                                    .addClass('username')
                                    .text(data.username)
                                    .css('color',getUsernameColor(data.username)),
                messageBodyDiv  = $('<span>')
                                    .addClass('messageBody')
                                    .text(data.message),
                typingClass     = data.typing ? 'typing' : '',
                messageDiv      = $('<li>')
                                    .addClass('message')
                                    .data('username',data.username)
                                    .addClass(typingClass)
                                    .append(usernameDiv,messageBodyDiv)
                                }
            else{
                var usernameDiv     = $('<span>')
                                        .addClass('username')
                                        .text(data.username)
                                        .css('color',"black"),
                    messageBodyDiv  = $('<span>')
                                        .addClass('messageBody')
                                        .text(data.message),
                    typingClass     = data.typing ? 'typing' : '',
                    messageDiv      = $('<li class="messageRow" text-align="center">')
                                        .append("<div class='buttonWrapper' style='float: right;'> <button class='reportButton' style='vertical-align: middle; padding-bottom: 2px;'>Report as chatbot!</button> </div>")
                                        .addClass('message')
                                        .data('username',data.username)
                                        .addClass(typingClass)
                                        .append(usernameDiv,messageBodyDiv);
                counter++;
            }
            $('.messageRow#buttonWrapper#reportButton').attr('id', function(counter) {
                return 'button '+(counter+1);
            })
            addMessageElement(messageDiv,options);
        }

        // add visual typing message
        function addChatTyping(data){
            data.typing = true;
            data.message = 'is typing';
            addChatMessage(data);
        }

        // remove visual typing message
        function removeChatTyping(data){
            getTypingMessages(data).fadeOut(function(){
                $(this).remove();
            });
        }

        function updateParticipantsWindow(){
            var keys            = Object.keys(chat.participants).sort(),
                participants    = UI.participants.find('li'),
                str             = '';

            if (chat.reconnecting === true)
                return false;

            // get all current keys
            var currentKeys = [];
            UI.participants.find('li').each(function(){currentKeys.push($(this).text())})

            doLog('updateParticipantsWindow',keys,currentKeys);

            if (participants.length){
                var lastElem,lastKey=0;

                for (var key in keys){

                    var foundKey = currentKeys.indexOf(keys[key]);

                    // find key in currentKeys
                    if (foundKey !== -1){
                        lastElem = $(participants.get(foundKey));
                        lastKey = foundKey + 1;
                    } else {
                        var currentElem = $(participants.get(lastKey));

                        if (keys[key] !== currentElem.text()){
                            var participant = createParticipantEntry(keys[key]);
                            if (lastElem){
                                lastElem.after(participant);
                                lastKey++;
                            } else {
                                UI.participants.prepend(participant);
                            }
                        } else {
                            lastKey++;
                        }

                        lastElem = $(participants.get(key));
                    }

                }

            } else {
                for (var key in keys)
                    str += createParticipantEntry(keys[key]);
                UI.participants.html(str);
            }
        }

        function createParticipantEntry(name){
            doLog('createParticipantEntry',name);
            if (name != chat.username) {
                name = "anonymous";
            }
            return '<li data-participant="' + name + '">' + name + '</li>';
        }

        /*
        *   Adds a message element to the messages and scrolls to the bottom
        *    el
        *       The element to add as a message
        *    options.fade
        *       If the element should fade-in (default = true)
        *    options.prepend
        *       If the element should prepend all other messages (default = false)
        */
        function addMessageElement(el, options) {
            doLog('addMessageElement',el, options);
            var $el = $(el);
            // setup options
            options = options || {};
            if (typeof options.fade === 'undefined')
                options.fade = true;
            if (typeof options.prepend === 'undefined')
                options.prepend = false;
            // Apply options
            if (options.fade)
                $el.hide().fadeIn(FADE_TIME);
            // append or prepend message
            if (options.prepend)
                UI.messages.prepend($el);
            else
                UI.messages.append($el);
            // auto scroll
            UI.messages[0].scrollTop = UI.messages[0].scrollHeight;
        }

        // Prevents input from having injected markup
        function cleanInput (input) {
            doLog('cleanInput',input);
            return $('<div/>').text(input).text();
        }

        // update typing event
        function updateTyping(){
            if (chat.connected){
                if(!chat.typing){
                    chat.typing = true;
                    socket.emit('typing');
                }
                chat.lastTypingTime = (new Date()).getTime();

                window.setTimeout(function(){
                    var typingTimer = (new Date()).getTime(),
                        timeDiff    = typingTimer - chat.lastTypingTime;
                        if (timeDiff >= TYPING_TIMER_LENGTH && chat.typing){
                            socket.emit('stop typing');
                            chat.typing = false;
                        }
                },TYPING_TIMER_LENGTH);
            }
        }

        // gets the 'X is typing' message of a user
        function getTypingMessages(data){
            doLog('getTypingMessages',data);
            return $('.typing.message').filter(function(i){
                return $(this).data('username') === data.username;
            });
        }

        // gets the color of a username though our hash functions
        function getUsernameColor(username){
            doLog('getUsernameColor',username);
            // compute hash code
            var hash = 7;
            for (var i = 0; i < username.length; i++){
                hash = username.charCodeAt(i) + (hash <<5 ) - hash;
            }
            // calculate color
            var index = Math.abs(hash % COLORS.length);
            return COLORS[index];
        }

        // Keyboard events
        $window.keydown(function(event){
            // auto focus the current input when a key is typed
            if (!(event.ctrlKey || event.metaKey || event.altKey)){
                UI.currentInput.focus();
            }
            // when the client hits ENTER on their keyboard
            if (event.which === 13){
                if (chat.username){
                    sendMessage();
                    socket.emit('stop typing');
                    chat.typing = false;
                } else {
                    if (!socket)
                        connectToSocket();
                    setUsername();
                }
            }
        });
         // css selector is messed up, needs fixing. Need to handle button clicked event differently
        $('body > ul > li.chat.page > div > ul > li:nth-child(3) > div > button').click(function(event){
            socket.emit('button clicked');
        });

        UI.inputMessage.on('input',function(){
            updateTyping();
        });

        // Click Events

        // Focus input when clicking anywhere on login page
        UI.loginPage.click(function(event){
            if (event.target.id !== 'lobby')
                UI.currentInput.focus();
        });

        // Focus input when clicking on the message input's border
        UI.inputMessage.click(function () {
            UI.inputMessage.focus();
        });

        function doLog(){
            console.log(Array.prototype.slice.call(arguments));
        }

        function connectToSocket(){
            doLog('connectToSocket');
            socket = io('/',{
                        query: 'lobby=' + UI.lobby.val()
                    });

            // Socket events
            socket.on('login',function(data){
                doLog('login',data);
                chat.connected = true;
                UI.loginPage.fadeOut();
                UI.chatPage.show();
                UI.participantsPage.show();
                UI.loginPage.off('click');
                UI.inputMessage.focus();
                // display welcome message
                if (chat.reconnecting === false){
                    var message = 'Welcome to Imitationga.me Chat - ' + UI.lobby.find('option:selected').text();
                    log(message,{
                        prepend:true
                    });
                    addParticipantMessage(data);
                } else {
                   chat.reconnecting = false;
                }
                // add all the current participants
                chat.participants = data.participants;
                updateParticipantsWindow();
            });

            // Socket events
            socket.on('connect',function(data){
                doLog('connect',data);
            });
            socket.on('disconnect',function(data){
                doLog('disconnect',data);
            });
            socket.on('reconnect',function(data){
                doLog('reconnect',data);
                if (chat.username){
                    chat.reconnecting = true;
                    socket.emit('add user',chat.username);
                }
            });

            socket.on('bad-login',function(data){
                doLog('bad-login',data);
                chat.connected      = false;
                chat.username       = '';
                window.clearTimeout(UI.timeout);
                console.log(UI.usernameInput.next());
                if (UI.usernameInput.next().length === 0)
                    UI.usernameInput.after('<div class="alert">Sorry but that username is already in use in this chat room.<br />Please try another one.</div>');
                UI.timeout = window.setTimeout(function(){
                    UI.usernameInput.next().fadeOut(function(){
                        $(this).remove();
                    });
                },1000);
            });

            socket.on('new message',function(data){
                doLog('new message',data);
                addChatMessage(data);
            });

            socket.on('user joined',function(data){
                doLog('user joined',data);
                log(data.username + ' joined');
                chat.participants[data.username] = data.username;
                addParticipantMessage(data);
                updateParticipantsWindow();
            });

            socket.on('user left',function(data){
                doLog('user left',data);
                log(data.username + ' left');
                addParticipantMessage(data);
                delete chat.participants[data.username];
                removeChatTyping(data);
                UI.participants.find('li[data-participant=' + data.username + ']').fadeOut(function(){
                    $(this).remove()
                });
            });

            socket.on('typing',function(data){
                addChatTyping(data);
            });

            socket.on('stop typing',function(data){
                removeChatTyping(data);
            });

            socket.on('button clicked',function(data){
                console.log(data.username + " clicked the button!");
            });
        }

});