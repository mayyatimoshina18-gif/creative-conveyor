const http = require("http");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Creative Conveyor is running");
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
