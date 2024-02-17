require("dotenv").config();

const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "http://localhost:8000",
  },
});

const mysql = require("mysql");
const moment = require("moment");
const sockets = {};

const conn = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

conn.connect(function (err) {
  if (err) throw err;
  console.log("Database connected");
});

io.on("connection", function (socket) {
  if (!sockets[socket.handshake.query.user_id]) {
    // instantiate into an array first to be able to push the socket
    sockets[socket.handshake.query.user_id] = [];
  }

  sockets[socket.handshake.query.user_id].push(socket);

  conn.query(
    `UPDATE users SET is_online=1 WHERE id=${socket.handshake.query.user_id}`,
    function (err, res) {
      if (err) throw err;
      console.log("User connected", socket.handshake.query.user_id);
      conn.query(
        `SELECT * FROM users WHERE id=${socket.handshake.query.user_id}`,
        function (err, res) {
          if (err) throw err;
          if (res[0]) {
            socket.broadcast.emit("user_connected", res[0]);
          }
        }
      );
    }
  );

  socket.on("send_message", function (data) {
    const group_id =
      data.user_id > data.other_user_id
        ? `${data.user_id}${data.other_user_id}`
        : `${data.other_user_id}${data.user_id}`;
    const time = moment().format("h:mm A");
    data.time = time;
    conn.query(
      `INSERT INTO chats (user_id, other_user_id, message, group_id) values (${data.user_id}, ${data.other_user_id}, '${data.message}', ${group_id})`,
      function (err, res) {
        if (err) throw err;
        data.id = res.insertId;
        for (const index in sockets[data.user_id]) {
          sockets[data.user_id][index].emit("receive_message", data);
        }
        conn.query(
          `SELECT count(id) as unread_messages from chats where user_id=${data.user_id} and other_user_id=${data.other_user_id} and is_read=0`,
          function (err, res) {
            if (err) throw err;
            data.unread_messages = res[0].unread_messages;
            for (const index in sockets[data.other_user_id]) {
              sockets[data.other_user_id][index].emit("receive_message", data);
            }
          }
        );
      }
    );
  });

  socket.on("read_message", function (id) {
    conn.query(
      `UPDATE chats set is_read=1 where id=${id}`,
      function (err, res) {
        if (err) throw err;
        console.log("Message read");
      }
    );
  });

  socket.on("user_typing", function (data) {
    for (const index in sockets[data.other_user_id]) {
      sockets[data.other_user_id][index].emit("user_typing", data);
    }
  });

  socket.on("disconnect", function (err) {
    socket.broadcast.emit("user_disconnected", socket.handshake.query.user_id);
    for (const index in sockets[socket.handshake.query.user_id]) {
      if (socket.id == sockets[socket.handshake.query.user_id][index].id) {
        sockets[socket.handshake.query.user_id].splice(index, 1);
      }
    }
    conn.query(
      `UPDATE users SET is_online=0 WHERE id=${socket.handshake.query.user_id}`,
      function (err, res) {
        if (err) throw err;
        console.log("User disconnected", socket.handshake.query.user_id);
      }
    );
  });
});

http.listen(process.env.PORT);
