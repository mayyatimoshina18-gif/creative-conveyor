const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD;

const waitingForManagerPassword = new Set();
const managers = new Set();
const userStates = new Map();
const tasks = [];
const executors = new Map();

const SPECIALIZATION_OPTIONS = ["Статика", "Моушен", "Лендинги"];
const DAY_OPTIONS = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье"
];
const PAYMENT_OPTIONS = [
  "Самозанятость",
  "ИП",
  "Переводом"
];

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

function sendDocument(chatId, fileId, caption) {
  sendTelegramRequest("sendDocument", {
    chat_id: chatId,
    document: fileId,
    caption
  });
}

function getMainKeyboard(isManager = false, isExecutorRegistered = false) {
  if (isManager) {
    return {
      keyboard: [
        [{ text: "Создать задачу" }],
        [{ text: "Мои задачи" }],
        [{ text: "Заявки в исполнители" }],
        [{ text: "Я исполнитель" }]
      ],
      resize_keyboard: true
    };
  }

  if (isExecutorRegistered) {
    return {
      keyboard: [
        [{ text: "Моя анкета" }],
        [{ text: "Редактировать анкету" }],
        [{ text: "Я менеджер" }]
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

function getDoneKeyboard(items) {
  return {
    keyboard: [
      items.map(item => ({ text: item })),
      [{ text: "Готово" }]
    ],
    resize_keyboard: true
  };
}

function getPaymentKeyboard() {
  return {
    keyboard: [PAYMENT_OPTIONS.map(item => ({ text: item }))],
    resize_keyboard: true
  };
}

function getModerationKeyboard() {
  return {
    keyboard: [
      [{ text: "Подтвердить исполнителя" }],
      [{ text: "Отклонить исполнителя" }],
      [{ text: "Следующая заявка" }],
      [{ text: "В меню менеджера" }]
    ],
    resize_keyboard: true
  };
}

function getManagerContact(from) {
  if (from?.username) return `@${from.username}`;
  if (from?.first_name) return `${from.first_name} (id: ${from.id})`;
  return `id: ${from?.id || "unknown"}`;
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

function formatField(field, label = "Материал") {
  if (!field) return "—";

  if (field.type === "text") {
    return field.value || "—";
  }

  if (field.type === "document") {
    if (field.caption && field.caption.trim()) {
      return `${label} прикреплено файлом.\nКомментарий: ${field.caption}`;
    }

    return `${label} прикреплено файлом.`;
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
    `${formatField(task.brief, "ТЗ")}`,
    ``,
    `Источники:`,
    `${formatField(task.sources, "Источники")}`,
    ``,
    `Референсы:`,
    `${formatField(task.references, "Референсы")}`,
    ``,
    `Комментарий:`,
    `${task.comment || "—"}`,
    ``,
    `Менеджер: ${task.managerContact}`
  ].join("\n");
}

function calculateBaseRating(accuracy, speed, aesthetics) {
  const startScore = accuracy * 0.4 + speed * 0.4 + aesthetics * 0.2;
  return Math.round(startScore * 20);
}

function calculateNewcomerBoost(baseRating) {
  if (baseRating >= 85) return 8;
  if (baseRating >= 75) return 7;
  if (baseRating >= 65) return 6;
  return 5;
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

function finishTaskCreation(chatId, state) {
  tasks.push(state.task);
  userStates.delete(chatId);

  sendMessage(
    chatId,
    `Задача создана.\n\n${formatTaskCard(state.task)}`,
    getMainKeyboard(true)
  );

  if (state.task.brief?.type === "document") {
    sendDocument(chatId, state.task.brief.file_id, "Файл ТЗ");
  }

  if (state.task.sources?.type === "document") {
    sendDocument(chatId, state.task.sources.file_id, "Файл с источниками");
  }

  if (state.task.references?.type === "document") {
    sendDocument(chatId, state.task.references.file_id, "Файл с референсами");
  }
}

function handleTaskCreationStep(chatId, message, state) {
  const text = message.text;
  const input = extractInput(message);

  if (!input && text !== "Пропустить") {
    sendMessage(chatId, "Не удалось прочитать сообщение. Отправь текст, ссылку или файл.");
    return;
  }

  if (state.step === "title") {
    if (!input || input.type !== "text") {
      sendMessage(chatId, "Название задачи лучше отправить текстом.");
      return;
    }

    state.task.title = input.value;
    state.step = "deadline";
    sendMessage(chatId, "Введи дедлайн. Например: сегодня до 18:00 или 16 марта 14:00.");
    return;
  }

  if (state.step === "deadline") {
    if (!input || input.type !== "text") {
      sendMessage(chatId, "Дедлайн лучше отправить текстом.");
      return;
    }

    state.task.deadline = input.value;
    state.step = "price";
    sendMessage(chatId, "Введи стоимость задачи. Например: 1500 ₽.");
    return;
  }

  if (state.step === "price") {
    if (!input || input.type !== "text") {
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
    state.task.brief = text === "Пропустить" ? null : input;
    state.step = "sources";
    sendMessage(
      chatId,
      "Отправь источники. Можно текст, ссылку или файл. Это поле необязательное.",
      getSkipKeyboard()
    );
    return;
  }

  if (state.step === "sources") {
    state.task.sources = text === "Пропустить" ? null : input;
    state.step = "references";
    sendMessage(
      chatId,
      "Отправь референсы. Можно текст, ссылку или файл. Это поле необязательное.",
      getSkipKeyboard()
    );
    return;
  }

  if (state.step === "references") {
    state.task.references = text === "Пропустить" ? null : input;
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
    } else if (input?.type === "text") {
      state.task.comment = input.value;
    } else if (input?.type === "document") {
      state.task.comment = input.caption?.trim()
        ? `Комментарий к файлу: ${input.caption}`
        : "Комментарий приложен файлом.";
    } else {
      state.task.comment = null;
    }

    finishTaskCreation(chatId, state);
  }
}

function startExecutorRegistration(chatId, from, existing = null) {
  userStates.set(chatId, {
    type: "executor_registration",
    step: "name",
    profile: {
      telegramId: from?.id || null,
      username: from?.username || null,
      telegramContact: from?.username ? `@${from.username}` : `id: ${from?.id || "unknown"}`,
      fullName: existing?.fullName || "",
      specializations: existing?.specializations || [],
      verifiedSpecializations: existing?.verifiedSpecializations || [],
      portfolio: existing?.portfolio || null,
      paymentMethod: existing?.paymentMethod || "",
      paymentDetails: existing?.paymentDetails || null,
      paymentFile: existing?.paymentFile || null,
      unavailableDays: existing?.unavailableDays || [],
      unavailableTime: existing?.unavailableTime || "",
      status: existing?.status || "На модерации",
      approvedBy: existing?.approvedBy || null,
      approvedByManagerId: existing?.approvedByManagerId || null,
      reviewAccuracy: typeof existing?.reviewAccuracy === "number" ? existing.reviewAccuracy : null,
      reviewSpeed: typeof existing?.reviewSpeed === "number" ? existing.reviewSpeed : null,
      reviewAesthetics: typeof existing?.reviewAesthetics === "number" ? existing.reviewAesthetics : null,
      baseRating: typeof existing?.baseRating === "number" ? existing.baseRating : null,
      newcomerBoost: typeof existing?.newcomerBoost === "number" ? existing.newcomerBoost : null,
      rating: typeof existing?.rating === "number" ? existing.rating : null,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });

  sendMessage(chatId, "Введи своё имя и фамилию.");
}

function formatExecutorProfile(profile) {
  return [
    `Анкета исполнителя`,
    ``,
    `Имя: ${profile.fullName || "—"}`,
    `Контакт: ${profile.telegramContact || "—"}`,
    `Специализации: ${profile.specializations?.length ? profile.specializations.join(", ") : "—"}`,
    `Подтверждённые специализации: ${profile.verifiedSpecializations?.length ? profile.verifiedSpecializations.join(", ") : "—"}`,
    `Портфолио: ${profile.portfolio || "—"}`,
    `Способ выплаты: ${profile.paymentMethod || "—"}`,
    `Платёжные данные: ${formatField(profile.paymentDetails, "Платёжные данные")}`,
    `Недоступные дни: ${profile.unavailableDays?.length ? profile.unavailableDays.join(", ") : "—"}`,
    `Недоступное время: ${profile.unavailableTime || "—"}`,
    `Статус: ${profile.status || "—"}`,
    `Подтвердил менеджер: ${profile.approvedBy || "—"}`,
    `Оценка по ТЗ: ${typeof profile.reviewAccuracy === "number" ? profile.reviewAccuracy : "—"}`,
    `Оценка скорости: ${typeof profile.reviewSpeed === "number" ? profile.reviewSpeed : "—"}`,
    `Оценка эстетики: ${typeof profile.reviewAesthetics === "number" ? profile.reviewAesthetics : "—"}`,
    `Базовый рейтинг: ${typeof profile.baseRating === "number" ? profile.baseRating : "—"}`,
    `Буст новичка: ${typeof profile.newcomerBoost === "number" ? `+${profile.newcomerBoost}` : "—"}`,
    `Итоговый рейтинг: ${typeof profile.rating === "number" ? profile.rating : "—"}`
  ].join("\n");
}

function notifyManagersAboutExecutor(profile) {
  if (managers.size === 0) {
    return;
  }

  const text = [
    `Новая анкета исполнителя`,
    ``,
    `Имя: ${profile.fullName || "—"}`,
    `Контакт: ${profile.telegramContact || "—"}`,
    `Специализации: ${profile.specializations?.length ? profile.specializations.join(", ") : "—"}`,
    `Портфолио: ${profile.portfolio || "—"}`,
    `Способ выплаты: ${profile.paymentMethod || "—"}`,
    `Платёжные данные: ${formatField(profile.paymentDetails, "Платёжные данные")}`,
    `Недоступные дни: ${profile.unavailableDays?.length ? profile.unavailableDays.join(", ") : "—"}`,
    `Недоступное время: ${profile.unavailableTime || "—"}`,
    `Статус: ${profile.status || "—"}`
  ].join("\n");

  for (const managerChatId of managers) {
    sendMessage(managerChatId, text, getMainKeyboard(true));

    if (profile.paymentFile?.type === "document") {
      sendDocument(managerChatId, profile.paymentFile.file_id, "Файл с реквизитами исполнителя");
    }
  }
}

function finishExecutorRegistration(chatId, state) {
  state.profile.updatedAt = new Date().toISOString();
  state.profile.status = "На модерации";
  state.profile.approvedBy = null;
  state.profile.approvedByManagerId = null;
  state.profile.verifiedSpecializations = [];
  state.profile.reviewAccuracy = null;
  state.profile.reviewSpeed = null;
  state.profile.reviewAesthetics = null;
  state.profile.baseRating = null;
  state.profile.newcomerBoost = null;
  state.profile.rating = null;

  executors.set(chatId, state.profile);
  userStates.delete(chatId);

  sendMessage(
    chatId,
    `Анкета сохранена и отправлена на модерацию.\n\n${formatExecutorProfile(state.profile)}`,
    getMainKeyboard(false, true)
  );

  if (state.profile.paymentFile?.type === "document") {
    sendDocument(chatId, state.profile.paymentFile.file_id, "Твой файл с реквизитами");
  }

  notifyManagersAboutExecutor(state.profile);
}

function handleExecutorRegistrationStep(chatId, message, state) {
  const text = message.text;
  const input = extractInput(message);

  if (state.step === "name") {
    if (!input || input.type !== "text") {
      sendMessage(chatId, "Имя лучше отправить текстом.");
      return;
    }

    state.profile.fullName = input.value;
    state.step = "specializations";
    state.profile.specializations = [];
    sendMessage(
      chatId,
      "Выбери специализации. Можно несколько. Нажимай кнопки по одной, потом нажми Готово.",
      getDoneKeyboard(SPECIALIZATION_OPTIONS)
    );
    return;
  }

  if (state.step === "specializations") {
    if (text === "Готово") {
      if (!state.profile.specializations.length) {
        sendMessage(chatId, "Нужно выбрать хотя бы одну специализацию.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
        return;
      }

      state.step = "portfolio";
      sendMessage(
        chatId,
        "Пришли ссылку на портфолио. Подойдёт любое портфолио, не обязательно по баннерам. Поле можно пропустить.",
        getSkipKeyboard()
      );
      return;
    }

    if (!SPECIALIZATION_OPTIONS.includes(text)) {
      sendMessage(chatId, "Выбери специализацию кнопкой или нажми Готово.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
      return;
    }

    if (!state.profile.specializations.includes(text)) {
      state.profile.specializations.push(text);
    }

    sendMessage(
      chatId,
      `Выбрано: ${state.profile.specializations.join(", ")}`,
      getDoneKeyboard(SPECIALIZATION_OPTIONS)
    );
    return;
  }

  if (state.step === "portfolio") {
    if (text === "Пропустить") {
      state.profile.portfolio = null;
    } else if (input?.type === "text") {
      state.profile.portfolio = input.value;
    } else {
      sendMessage(chatId, "Портфолио лучше отправить текстом или ссылкой. Либо нажми Пропустить.", getSkipKeyboard());
      return;
    }

    state.step = "payment_method";
    sendMessage(chatId, "Выбери удобный способ выплаты.", getPaymentKeyboard());
    return;
  }

  if (state.step === "payment_method") {
    if (!PAYMENT_OPTIONS.includes(text)) {
      sendMessage(chatId, "Выбери один из вариантов выплаты кнопкой.", getPaymentKeyboard());
      return;
    }

    state.profile.paymentMethod = text;

    if (text === "Переводом") {
      state.step = "payment_details_transfer";
      sendMessage(chatId, "Введи номер телефона или карты для выплаты.");
      return;
    }

    state.step = "payment_details_business";
    sendMessage(
      chatId,
      `Введи реквизиты для ${text}. Потом отдельным сообщением можно будет приложить файл.`
    );
    return;
  }

  if (state.step === "payment_details_transfer") {
    if (!input || input.type !== "text") {
      sendMessage(chatId, "Реквизиты лучше отправить текстом.");
      return;
    }

    state.profile.paymentDetails = input;
    state.profile.paymentFile = null;
    state.step = "unavailable_days";
    state.profile.unavailableDays = [];
    sendMessage(
      chatId,
      "Выбери дни, когда ты точно не можешь брать срочные задачи. Можно несколько. Потом нажми Готово. Если таких дней нет — сразу нажми Готово.",
      getDoneKeyboard(DAY_OPTIONS)
    );
    return;
  }

  if (state.step === "payment_details_business") {
    if (!input || input.type !== "text") {
      sendMessage(chatId, "Реквизиты лучше отправить текстом.");
      return;
    }

    state.profile.paymentDetails = input;
    state.step = "payment_file";
    sendMessage(
      chatId,
      "Теперь можешь приложить файл с реквизитами. Это поле необязательное.",
      getSkipKeyboard()
    );
    return;
  }

  if (state.step === "payment_file") {
    if (text === "Пропустить") {
      state.profile.paymentFile = null;
    } else if (message.document) {
      state.profile.paymentFile = extractInput(message);
    } else {
      sendMessage(chatId, "Пришли файл или нажми Пропустить.", getSkipKeyboard());
      return;
    }

    state.step = "unavailable_days";
    state.profile.unavailableDays = [];
    sendMessage(
      chatId,
      "Выбери дни, когда ты точно не можешь брать срочные задачи. Можно несколько. Потом нажми Готово. Если таких дней нет — сразу нажми Готово.",
      getDoneKeyboard(DAY_OPTIONS)
    );
    return;
  }

  if (state.step === "unavailable_days") {
    if (text === "Готово") {
      state.step = "unavailable_time";
      sendMessage(
        chatId,
        "Если есть временные промежутки, когда ты не можешь брать задачи, напиши их текстом. Например: по будням с 10:00 до 14:00. Если ограничений нет — нажми Пропустить.",
        getSkipKeyboard()
      );
      return;
    }

    if (!DAY_OPTIONS.includes(text)) {
      sendMessage(chatId, "Выбери день кнопкой или нажми Готово.", getDoneKeyboard(DAY_OPTIONS));
      return;
    }

    if (!state.profile.unavailableDays.includes(text)) {
      state.profile.unavailableDays.push(text);
    }

    sendMessage(
      chatId,
      `Выбрано: ${state.profile.unavailableDays.join(", ") || "—"}`,
      getDoneKeyboard(DAY_OPTIONS)
    );
    return;
  }

  if (state.step === "unavailable_time") {
    if (text === "Пропустить") {
      state.profile.unavailableTime = "";
    } else if (input?.type === "text") {
      state.profile.unavailableTime = input.value;
    } else {
      sendMessage(chatId, "Напиши время текстом или нажми Пропустить.", getSkipKeyboard());
      return;
    }

    finishExecutorRegistration(chatId, state);
  }
}

function getPendingExecutors() {
  return Array.from(executors.values()).filter(profile => profile.status === "На модерации");
}

function findExecutorByTelegramId(telegramId) {
  for (const [chatId, profile] of executors.entries()) {
    if (profile.telegramId === telegramId) {
      return { chatId, profile };
    }
  }
  return null;
}

function showNextPendingExecutor(managerChatId) {
  const pending = getPendingExecutors();

  if (!pending.length) {
    userStates.delete(managerChatId);
    sendMessage(
      managerChatId,
      "Заявок на модерации сейчас нет.",
      getMainKeyboard(true)
    );
    return;
  }

  const profile = pending[0];

  userStates.set(managerChatId, {
    type: "manager_review_executor",
    step: "decision",
    targetExecutorTelegramId: profile.telegramId,
    selectedSpecializations: [],
    reviewAccuracy: null,
    reviewSpeed: null,
    reviewAesthetics: null
  });

  sendMessage(
    managerChatId,
    `Заявка на модерацию\n\n${formatExecutorProfile(profile)}`,
    getModerationKeyboard()
  );

  if (profile.paymentFile?.type === "document") {
    sendDocument(managerChatId, profile.paymentFile.file_id, "Файл с реквизитами исполнителя");
  }
}

function handleManagerReviewStep(chatId, text, from, state) {
  const found = findExecutorByTelegramId(state.targetExecutorTelegramId);

  if (!found) {
    userStates.delete(chatId);
    sendMessage(chatId, "Исполнитель для модерации не найден.", getMainKeyboard(true));
    return;
  }

  const executorChatId = found.chatId;
  const profile = found.profile;

  if (state.step === "decision") {
    if (text === "Следующая заявка") {
      showNextPendingExecutor(chatId);
      return;
    }

    if (text === "В меню менеджера") {
      userStates.delete(chatId);
      sendMessage(chatId, "Вернулись в меню менеджера.", getMainKeyboard(true));
      return;
    }

    if (text === "Отклонить исполнителя") {
      profile.status = "Отклонён";
      profile.approvedBy = getManagerContact(from);
      profile.approvedByManagerId = from?.id || null;
      profile.verifiedSpecializations = [];
      profile.reviewAccuracy = null;
      profile.reviewSpeed = null;
      profile.reviewAesthetics = null;
      profile.baseRating = null;
      profile.newcomerBoost = null;
      profile.rating = null;
      profile.updatedAt = new Date().toISOString();
      executors.set(executorChatId, profile);

      userStates.delete(chatId);

      sendMessage(
        executorChatId,
        "Твоя анкета отклонена менеджером. Позже можно будет отредактировать анкету и отправить её снова.",
        getMainKeyboard(false, true)
      );

      sendMessage(chatId, "Исполнитель отклонён.", getMainKeyboard(true));
      return;
    }

    if (text === "Подтвердить исполнителя") {
      state.step = "verified_specializations";
      state.selectedSpecializations = [];
      sendMessage(
        chatId,
        "Выбери подтверждённые специализации. Можно несколько. Потом нажми Готово.",
        getDoneKeyboard(SPECIALIZATION_OPTIONS)
      );
      return;
    }

    sendMessage(chatId, "Выбери действие по заявке.", getModerationKeyboard());
    return;
  }

  if (state.step === "verified_specializations") {
    if (text === "Готово") {
      if (!state.selectedSpecializations.length) {
        sendMessage(chatId, "Нужно подтвердить хотя бы одну специализацию.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
        return;
      }

      state.step = "review_accuracy";
      sendMessage(chatId, "Оцени соблюдение ТЗ по шкале от 1 до 5.");
      return;
    }

    if (!SPECIALIZATION_OPTIONS.includes(text)) {
      sendMessage(chatId, "Выбери специализацию кнопкой или нажми Готово.", getDoneKeyboard(SPECIALIZATION_OPTIONS));
      return;
    }

    if (!state.selectedSpecializations.includes(text)) {
      state.selectedSpecializations.push(text);
    }

    sendMessage(
      chatId,
      `Подтверждено: ${state.selectedSpecializations.join(", ")}`,
      getDoneKeyboard(SPECIALIZATION_OPTIONS)
    );
    return;
  }

  if (state.step === "review_accuracy") {
    const value = Number(text);

    if (!Number.isInteger(value) || value < 1 || value > 5) {
      sendMessage(chatId, "Введи целое число от 1 до 5.");
      return;
    }

    state.reviewAccuracy = value;
    state.step = "review_speed";
    sendMessage(chatId, "Оцени скорость по шкале от 1 до 5.");
    return;
  }

  if (state.step === "review_speed") {
    const value = Number(text);

    if (!Number.isInteger(value) || value < 1 || value > 5) {
      sendMessage(chatId, "Введи целое число от 1 до 5.");
      return;
    }

    state.reviewSpeed = value;
    state.step = "review_aesthetics";
    sendMessage(chatId, "Оцени эстетику по шкале от 1 до 5.");
    return;
  }

  if (state.step === "review_aesthetics") {
    const value = Number(text);

    if (!Number.isInteger(value) || value < 1 || value > 5) {
      sendMessage(chatId, "Введи целое число от 1 до 5.");
      return;
    }

    state.reviewAesthetics = value;

    const baseRating = calculateBaseRating(
      state.reviewAccuracy,
      state.reviewSpeed,
      state.reviewAesthetics
    );
    const newcomerBoost = calculateNewcomerBoost(baseRating);
    const finalRating = baseRating + newcomerBoost;

    profile.status = "Подтверждён";
    profile.approvedBy = getManagerContact(from);
    profile.approvedByManagerId = from?.id || null;
    profile.verifiedSpecializations = [...state.selectedSpecializations];
    profile.reviewAccuracy = state.reviewAccuracy;
    profile.reviewSpeed = state.reviewSpeed;
    profile.reviewAesthetics = state.reviewAesthetics;
    profile.baseRating = baseRating;
    profile.newcomerBoost = newcomerBoost;
    profile.rating = finalRating;
    profile.updatedAt = new Date().toISOString();
    executors.set(executorChatId, profile);

    userStates.delete(chatId);

    sendMessage(
      executorChatId,
      `Твоя анкета подтверждена.\n\n${formatExecutorProfile(profile)}`,
      getMainKeyboard(false, true)
    );

    if (profile.paymentFile?.type === "document") {
      sendDocument(executorChatId, profile.paymentFile.file_id, "Твой файл с реквизитами");
    }

    sendMessage(
      chatId,
      `Исполнитель подтверждён.\n\nБазовый рейтинг: ${baseRating}\nБуст новичка: +${newcomerBoost}\nИтоговый рейтинг: ${finalRating}`,
      getMainKeyboard(true)
    );
    return;
  }
}

function handleTextMessage(chatId, text, from, message) {
  const state = userStates.get(chatId);
  const executorProfile = executors.get(chatId);

  if (text === "/start") {
    userStates.delete(chatId);
    sendMessage(chatId, "Привет. Выбери роль:", getMainKeyboard(managers.has(chatId), Boolean(executorProfile)));
    return;
  }

  if (state?.type === "create_task") {
    handleTaskCreationStep(chatId, message, state);
    return;
  }

  if (state?.type === "executor_registration") {
    handleExecutorRegistrationStep(chatId, message, state);
    return;
  }

  if (state?.type === "manager_review_executor") {
    handleManagerReviewStep(chatId, text, from, state);
    return;
  }

  if (text === "Я исполнитель") {
    waitingForManagerPassword.delete(chatId);

    if (executorProfile) {
      sendMessage(
        chatId,
        `Режим исполнителя включён.\n\n${formatExecutorProfile(executorProfile)}`,
        getMainKeyboard(false, true)
      );
      return;
    }

    sendMessage(
      chatId,
      "Начинаем регистрацию исполнителя.",
      getMainKeyboard(false)
    );
    startExecutorRegistration(chatId, from, null);
    return;
  }

  if (text === "Моя анкета") {
    if (!executorProfile) {
      sendMessage(chatId, "Анкета пока не заполнена. Нажми Я исполнитель, чтобы начать.", getMainKeyboard(false));
      return;
    }

    sendMessage(chatId, formatExecutorProfile(executorProfile), getMainKeyboard(false, true));

    if (executorProfile.paymentFile?.type === "document") {
      sendDocument(chatId, executorProfile.paymentFile.file_id, "Твой файл с реквизитами");
    }
    return;
  }

  if (text === "Редактировать анкету") {
    startExecutorRegistration(chatId, from, executorProfile || null);
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
      sendMessage(chatId, "Доступ менеджера открыт.", getMainKeyboard(true));
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

    if (text === "Заявки в исполнители") {
      showNextPendingExecutor(chatId);
      return;
    }

    if (text === "В меню менеджера") {
      sendMessage(chatId, "Меню менеджера.", getMainKeyboard(true));
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
