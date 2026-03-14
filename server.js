const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD;

const waitingForManagerPassword = new Set();
const managers = new Set();

function sendTelegramRequest(method, payload, callback) {
  if (!BOT_TOKEN) {
    console.log("BOT_TOKEN is missing");
    return;
  }

  const data = JSON.stringify(payload);

  const options = {
    hostname: "api.telegram.org",
    path: `/bot${BOT_TOKEN}/${method}`,
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
      console.log(`${method} response:`, body);
      if (callback) callback(body);
    });
  });

  req.on("error", error => {
    console.error(`${method} error:`, error);
  });

  req.write(data);
  req.end();
}

function sendMessage(chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  sendTelegramRequest("sendMessage", payload);
}

function handleTextMessage(chatId, text) {
  if (text === "/start") {
    sendMessage(
      chatId,
      "Привет. Выбери роль:",
      {
        keyboard: [
          [{ text: "Я исполнитель" }],
          [{ text: "Я менеджер" }]
        ],
        resize_keyboard: true
      }
    );
    return;
  }

  if (text === "Я исполнитель") {
    waitingForManagerPassword.delete(chatId);
    sendMessage(
      chatId,
      "Режим исполнителя включён. Позже здесь будут профиль, задачи, статус и рейтинг."
    );
    return;
  }

  if (text === "Я менеджер") {
    waitingForManagerPassword.add(chatId);
    sendMessage(chatId, "Введи пароль менеджера.");
    return;
  }

  if (waitingForManagerPassword.has(chatId)) {
    if (text === MANAGER_PASSWORD) {
      waitingForManagerPassword.delete(chatId);
      managers.add(chatId);
      sendMessage(
        chatId,
        "Доступ менеджера открыт. Позже здесь будут создание задач, контроль статусов и архив."
      );
    } else {
      sendMessage(chatId, "Неверный пароль. Попробуй ещё раз.");
    }
    return;
  }

  if (managers.has(chatId)) {
    sendMessage(
      chatId,
      `Ты в режиме менеджера. Сообщение получено: ${text}`
    );
    return;
  }

  sendMessage(
    chatId,
    "Напиши /start, чтобы выбрать роль."
  );
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
          handleTextMessage(chatId, text);
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
