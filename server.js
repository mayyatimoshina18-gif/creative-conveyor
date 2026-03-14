const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD;

const waitingForManagerPassword = new Set();
const managers = new Set();
const userStates = new Map();
const tasks = [];

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

function getMainKeyboard(isManager = false) {
  if (isManager) {
    return {
      keyboard: [
        [{ text: "Создать задачу" }],
        [{ text: "Мои задачи" }],
        [{ text: "Я исполнитель" }]
      ],
      resize_keyboard: true
    };
  }

  return {
    keyboard: [
      [{ text: "Я исполнитель" }],
      [{ text: "Я менеджер" }]
    ],
    resize_keyboard: true
  };
}

function getSkipKeyboard() {
  return {
    keyboard: [[{ text: "Пропустить" }]],
    resize_keyboard: true
  };
}

function getManagerContact(from) {
  if (from?.username) {
    return `@${from.username}`;
  }

  if (from?.first_name) {
    return `${from.first_name} (id: ${from.id})`;
  }

  return `id: ${from?.id || "unknown"}`;
}

function startTaskCreation(chatId, from) {
  userStates.set(chatId, {
    type: "create_task",
    step: "title",
    task: {
      id: tasks.length + 1,
      createdAt: new Date().toISOString(),
      managerId: from?.id || null,
      managerUsername: from?.username || null,
      managerContact: getManagerContact(from),
      title: "",
      deadline: "",
      price: "",
      brief: null,
      sources: null,
      references: null,
      comment: null
    }
  });

  sendMessage(chatId, "Введи название задачи.");
}

function formatField(field) {
  if (!field) return "—";

  if (field.type === "text") {
    return field.value || "—";
  }

  if (field.type === "document") {
    return `Файл: ${field.file_name || "без имени"}\nfile_id: ${field.file_id}${field.caption ? `\nКомментарий: ${field.caption}` : ""}`;
  }

  return "—";
}

function formatTaskCard(task) {
  return [
    `Задача #${task.id}`,
    ``,
    `Название: ${task.title || "—"}`,
    `Дедлайн: ${task.deadline || "—"}`,
    `Стоимость: ${task.price || "—"}`,
    ``,
    `ТЗ:`,
    `${formatField(task.brief)}`,
    ``,
    `Источники:`,
    `${formatField(task.sources)}`,
    ``,
    `Референсы:`,
    `${formatField(task.references)}`,
    ``,
    `Комментарий:`,
    `${task.comment || "—"}`,
    ``,
    `Менеджер: ${task.managerContact}`
  ].join("\n");
}

function finishTaskCreation(chatId, state) {
  tasks.push(state.task);
  userStates.delete(chatId);

  sendMessage(
    chatId,
    `Задача создана.\n\n${formatTaskCard(state.task)}`,
    getMainKeyboard(true)
  );
}

function extractInput(message) {
  if (message.document) {
    return {
      type: "document",
      file_id: message.document.file_id,
      file_name: message.document.file_name || null,
      mime_type: message.document.mime_type || null,
      caption: message.caption || ""
    };
  }

  if (message.text) {
    return {
      type: "text",
      value: message.text
    };
  }

  return null;
}

function handleTaskCreationStep(chatId, message, state) {
  const text = message.text;
  const input = extractInput(message);

  if (!input) {
    sendMessage(chatId, "Не удалось прочитать сообщение. Отправь текст, ссылку или файл.");
    return;
  }

  if (state.step === "title") {
    if (input.type !== "text") {
      sendMessage(chatId, "Название задачи лучше отправить текстом.");
      return;
    }

    state.task.title = input.value;
    state.step = "deadline";
    sendMessage(chatId, "Введи дедлайн. Например: сегодня до 18:00 или 16 марта 14:00.");
    return;
  }

  if (state.step === "deadline") {
    if (input.type !== "text") {
      sendMessage(chatId, "Дедлайн лучше отправить текстом.");
      return;
    }

    state.task.deadline = input.value;
    state.step = "price";
    sendMessage(chatId, "Введи стоимость задачи. Например: 1500 ₽.");
    return;
  }

  if (state.step === "price") {
    if (input.type !== "text") {
      sendMessage(chatId, "Стоимость лучше отправить текстом.");
      return;
    }

    state.task.price = input.value;
    state.step = "brief";
    sendMessage(
      chatId,
      "Отправь ТЗ. Можно текст, ссылку или файл.",
      getSkipKeyboard()
    );
    return;
  }

  if (state.step === "brief") {
    if (text === "Пропустить") {
      state.task.brief = null;
    } else {
      state.task.brief = input;
    }

    state.step = "sources";
    sendMessage(
      chatId,
      "Отправь источники. Можно текст, ссылку или файл. Это поле необязательное.",
      getSkipKeyboard()
    );
    return;
  }

  if (state.step === "sources") {
    if (text === "Пропустить") {
      state.task.sources = null;
    } else {
      state.task.sources = input;
    }

    state.step = "references";
    sendMessage(
      chatId,
      "Отправь референсы. Можно текст, ссылку или файл. Это поле необязательное.",
      getSkipKeyboard()
    );
    return;
  }

  if (state.step === "references") {
    if (text === "Пропустить") {
      state.task.references = null;
    } else {
      state.task.references = input;
    }

    state.step = "comment";
    sendMessage(
      chatId,
      "Отправь комментарий. Это поле необязательное.",
      getSkipKeyboard()
    );
    return;
  }

  if (state.step === "comment") {
    if (text === "Пропустить") {
      state.task.comment = null;
    } else if (input.type === "text") {
      state.task.comment = input.value;
    } else {
      state.task.comment = `Файл: ${input.file_name || "без имени"}${input.caption ? ` | ${input.caption}` : ""}`;
    }

    finishTaskCreation(chatId, state);
  }
}

function handleTextMessage(chatId, text, from, message) {
  const state = userStates.get(chatId);

  if (text === "/start") {
    userStates.delete(chatId);
    sendMessage(chatId, "Привет. Выбери роль:", getMainKeyboard(managers.has(chatId)));
    return;
  }

  if (state?.type === "create_task") {
    handleTaskCreationStep(chatId, message, state);
    return;
  }

  if (text === "Я исполнитель") {
    waitingForManagerPassword.delete(chatId);
    userStates.delete(chatId);
    sendMessage(
      chatId,
      "Режим исполнителя включён. Позже здесь будут профиль, задачи, статус и рейтинг.",
      getMainKeyboard(false)
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
        "Доступ менеджера открыт.",
        getMainKeyboard(true)
      );
    } else {
      sendMessage(chatId, "Неверный пароль. Попробуй ещё раз.");
    }
    return;
  }

  if (managers.has(chatId)) {
    if (text === "Создать задачу") {
      startTaskCreation(chatId, from);
      return;
    }

    if (text === "Мои задачи") {
      const managerTasks = tasks.filter(task => task.managerId === from?.id);

      if (!managerTasks.length) {
        sendMessage(chatId, "У тебя пока нет созданных задач.", getMainKeyboard(true));
        return;
      }

      const summary = managerTasks
        .map(task => `#${task.id} — ${task.title} | ${task.deadline} | ${task.price}`)
        .join("\n");

      sendMessage(chatId, `Твои задачи:\n\n${summary}`, getMainKeyboard(true));
      return;
    }

    sendMessage(chatId, "Ты в режиме менеджера. Выбери действие из меню.", getMainKeyboard(true));
    return;
  }

  sendMessage(chatId, "Напиши /start, чтобы выбрать роль.");
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
        const message = update.message;
        const chatId = message?.chat?.id;
        const text = message?.text || null;
        const from = message?.from || null;

        if (chatId && message) {
          handleTextMessage(chatId, text, from, message);
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
