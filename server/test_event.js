const { io } = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Connected to server");
  socket.emit("resign", { gameId: "123", userId: "abc" });
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err);
});
