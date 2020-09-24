// ce js est executé par le serveur

import express from "express";
import http from "http";
import socketIO from 'socket.io';
import DbConnection from './db';

const app = express();
//de 5 à 8 on créé notre serveur
const port = 3000;
const server = http.createServer(app);
const io = socketIO(server);
let ids = 0;
const userIds = {};
let sendMsg = [];
const userPseudos = {};


//de 11 à 16 on créé les routes pour afficher les html avec la feuille de style
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/chat.html');
});
app.get('/chatcss', (req, res) => {
    res.sendFile(__dirname + '/chat.css');
});

const dbConnection = new DbConnection(false);
dbConnection.performQuery("SELECT * FROM messages").then(result => {
    result.rows.forEach(message => {
        console.log(message);
        // Ici, ajoutez les messages issu de la DB au tableau qui sert à garder en mémoire les messages (9)
        sendMsg.push(message.content);
    });
});

// io.on evenement qui est declenché qd un utilisateur utilise un websocket(se connecte)
io.on('connection', (socket, pseudo) => {//le socket est créé lorqu'un utilisateur s'inscrit
    userIds[socket.id] = ++ids;
    console.log(userIds);
    console.log(`un nouvel utilisateur s'est connecté: ${socket.id}`);

    //pour afficher la liste des users connectés(id + pseudo) + la liste des users deja connecté
    let userList = [];
    for(let userSocket in userIds){
        if(userSocket !== socket.id){
            userList.push({id : userIds[userSocket], pseudo : userPseudos[userSocket]});
        }
    }

    socket.emit("connection_successful", { id: userIds[socket.id], histo: sendMsg, userList : userList });

    socket.on('setPseudo', pseudo => {
        console.log(pseudo);
        if (pseudo) {
            userPseudos[socket.id] = pseudo;
        } else {
            userPseudos[socket.id] = userIds[socket.id]
        }
        console.log(userPseudos);

        socket.broadcast.emit("user_connect", { msg : `L'utilisateur ${userIds[socket.id]} s'est connecté.`,
                                            id : userIds[socket.id],
                                            pseudo : userPseudos[socket.id]});
    })

    //evenement lié au socket créé, lorsqu'il se deconnect, on peut faire des taitements
    //signalé aux autres utilisateurs que qqun c'est déconnecté
    socket.on('disconnect', () => {
        console.log(`L'utilisateur ${userIds[socket.id]} s'est déconnecté`);
        console.log(`L'utilisateur ${userPseudos[socket.id]} s'est déconnecté`);
        socket.broadcast.emit("user_disconnect",
        {   id : userIds[socket.id] ,
            msg : `L'utilisateur ${userIds[socket.id]} s'est déconnecté. `});

        delete userIds[socket.id];
        delete userPseudos[socket.id];
    });

    // Traitement à effectuer quand le serveur reçoit l'évènement "chat_message" de l’utilisateur
    socket.on('chat_message', (msg) => {
        console.log(`Contenu du message: ${userIds[socket.id]} :  ` + msg);
        //const formatMessage = `${userIds[socket.id]} :  ` + msg;
        //sendMsg.push(`${userIds[socket.id]} :  ` + msg);
        //io.emit('chat_message', `${userIds[socket.id]} :  ` + msg); // On émet l'évènement vers TOUS les utilisateurs (y compris l’émetteur)

        const formatMessage = `${userPseudos[socket.id]} :  ` + msg;
        dbConnection.performQuery("INSERT INTO messages (content) VALUES (?)", [formatMessage]);

        sendMsg.push(formatMessage);
        io.emit('chat_message', formatMessage); // On émet l'évènement vers TOUS les utilisateurs (y compris l’émetteur)
    });
});
server.listen(port, () => console.log(`Example app listening on port ${port}!`));