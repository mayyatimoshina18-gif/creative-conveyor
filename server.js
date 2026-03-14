const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

function sendMessage(chatId, text) {
  if (!BOT_TOKEN) {
    console.log("BOT_TOKEN is missing");
    return;
  }

  const data = JSON.stringify({
    chat_id: chatId,
    text
  });

  const options = {
    hostname: "api.telegram.org",
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    }
  };

  const req = https.request(options, res => {
    let body = "";

    res.on("data", chunk => {
      body += chunk.toString();
    });

    res.on("end", () => {
      console.log("sendMessage response:", body);
    });
  });

  req.on("error", error => {
    console.error("sendMessage error:", error);
  });

  req.write(data);
  req.end();
}

const server = http.createServer((req, res) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);

  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Creative Conveyor is running");
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "POST" && req.url === "/webhook") {
    let body = "";

    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", () => {
      console.log("Webhook update:", body);

      try {
        const update = JSON.parse(body);
        const chatId = update.message?.chat?.id;
        const text = update.message?.text;

        if (chatId && text) {
          sendMessage(chatId, `Получила сообщение: ${text}`);
        }
      } catch (error) {
        console.error("Parse error:", error);
      }

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true }));
    });

    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
