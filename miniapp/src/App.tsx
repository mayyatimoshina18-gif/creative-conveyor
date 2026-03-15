import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Users,
  Trophy,
  Calculator,
  PlusSquare,
  ChevronRight,
  Lock,
  Search,
  Clock3,
  Archive,
  CircleDot
} from "lucide-react";

const demoTasks = {
  waiting: [
    {
      id: 12,
      title: "Баннеры для Telegram-кампании",
      type: ["Статика"],
      deadline: "16 марта, 18:00",
      price: "6 000 ₽",
      manager: "@YYT1M"
    },
    {
      id: 13,
      title: "Пак сторис + motion-плашки",
      type: ["Статика", "Моушен"],
      deadline: "17 марта, 12:00",
      price: "12 000 ₽",
      manager: "@YYT1M"
    }
  ],
  active: [
    {
      id: 9,
      title: "Лендинг для спецпроекта",
      type: ["Лендинги"],
      deadline: "18 марта, 20:00",
      price: "35 000 ₽",
      manager: "@YYT1M"
    },
    {
      id: 10,
      title: "KV + ресайзы на digital",
      type: ["Статика"],
      deadline: "19 марта, 14:00",
      price: "14 000 ₽",
      manager: "@YYT1M"
    }
  ],
  archived: [
    {
      id: 4,
      title: "Motion-тизеры для запуска",
      type: ["Моушен"],
      deadline: "12 марта, 16:00",
      price: "18 000 ₽",
      manager: "@YYT1M"
    }
  ]
};

const topTabs = [
  { key: "waiting", label: "Ждут исполнителя", icon: CircleDot },
  { key: "active", label: "Активные", icon: Clock3 },
  { key: "archived", label: "Архивные", icon: Archive }
];

const bottomTabs = [
  { key: "tasks", label: "Задачи", icon: Briefcase },
  { key: "applications", label: "Заявки", icon: Users },
  { key: "rating", label: "Рейтинг", icon: Trophy },
  { key: "calculator", label: "Калькулятор", icon: Calculator },
  { key: "create", label: "Создать", icon: PlusSquare }
];

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

function RoleButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-left text-lg font-medium text-white transition hover:bg-white/10 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <ChevronRight className="h-5 w-5 text-white/50" />
      </div>
    </button>
  );
}

function TaskCard({ task }: { task: (typeof demoTasks.waiting)[number] }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.18 }}
      className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.28)]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/35">Задача #{task.id}</div>
          <div className="text-base font-semibold leading-5 text-white">{task.title}</div>
        </div>
        <button className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
          Открыть
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {task.type.map((item) => (
          <span
            key={item}
            className="rounded-full border border-[#56FFEF]/20 bg-[#56FFEF]/10 px-2.5 py-1 text-xs text-[#56FFEF]"
          >
            {item}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-white/75">
        <div className="rounded-2xl bg-black/20 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Дедлайн</div>
          <div>{task.deadline}</div>
        </div>
        <div className="rounded-2xl bg-black/20 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">Стоимость</div>
          <div>{task.price}</div>
        </div>
      </div>

      <div className="mt-3 text-sm text-white/55">Менеджер: {task.manager}</div>
    </motion.div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<"welcome" | "managerPassword" | "managerApp">("welcome");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [activeTopTab, setActiveTopTab] = useState<"waiting" | "active" | "archived">("waiting");
  const [activeBottomTab, setActiveBottomTab] = useState("tasks");

  const visibleTasks = useMemo(() => demoTasks[activeTopTab], [activeTopTab]);

  const handleManagerLogin = () => {
    if (!password.trim()) {
      setPasswordError("Введи пароль менеджера");
      return;
    }
    setPasswordError("");
    setScreen("managerApp");
  };

  return (
    <div
      className="min-h-screen bg-[#09090B] text-white"
      style={{ fontFamily: "Involve, Inter, system-ui, sans-serif" }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[radial-gradient(circle_at_top,rgba(86,255,239,0.14),transparent_34%),linear-gradient(180deg,#0b0b10_0%,#09090b_100%)]">
        <AnimatePresence mode="wait">
          {screen === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.22 }}
              className="flex min-h-screen flex-col px-6 pb-8 pt-12"
            >
              <div className="mb-10 mt-auto">
                <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">
                  ЛЭНД
                </div>
                <h1 className="max-w-[320px] text-[34px] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                  Привет! Это креативный конвейер ЛЭНД
                </h1>
                <p className="mt-4 text-base text-white/45">Выбери роль</p>
              </div>

              <div className="mb-auto space-y-3">
                <RoleButton label="Я менеджер" onClick={() => setScreen("managerPassword")} />
                <RoleButton label="Я исполнитель" onClick={() => {}} />
              </div>
            </motion.div>
          )}

          {screen === "managerPassword" && (
            <motion.div
              key="managerPassword"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.22 }}
              className="flex min-h-screen flex-col px-6 pb-8 pt-12"
            >
              <button
                onClick={() => setScreen("welcome")}
                className="mb-8 w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70"
              >
                Назад
              </button>

              <div className="mb-8">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Lock className="h-5 w-5 text-white/70" />
                </div>
                <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">Вход менеджера</h2>
                <p className="mt-2 text-sm text-white/45">Введи пароль, чтобы открыть менеджерский интерфейс</p>
              </div>

              <div className="space-y-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль"
                  className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/25"
                />
                {passwordError ? <div className="px-1 text-sm text-rose-300">{passwordError}</div> : null}
                <button
                  onClick={handleManagerLogin}
                  className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 active:scale-[0.99]"
                >
                  Войти
                </button>
              </div>
            </motion.div>
          )}

          {screen === "managerApp" && (
            <motion.div
              key="managerApp"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.22 }}
              className="flex min-h-screen flex-col"
            >
              <div className="sticky top-0 z-10 border-b border-white/5 bg-[#0b0b10]/90 px-5 pb-4 pt-6 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">Креативный конвейер ЛЭНД</div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">Задачи</div>
                  </div>
                  <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70">
                    <Search className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-white/8 bg-white/[0.03] p-1.5">
                  {topTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTopTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTopTab(tab.key as typeof activeTopTab)}
                        className={cn(
                          "rounded-[18px] px-3 py-3 text-left transition",
                          active ? "bg-[#56FFEF] text-black" : "text-white/50 hover:bg-white/5"
                        )}
                      >
                        <Icon className="mb-2 h-4 w-4" />
                        <div className="text-[12px] font-medium leading-4">{tab.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 px-5 pb-28 pt-4">
                {activeBottomTab === "tasks" ? (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="text-sm text-white/45">
                        {activeTopTab === "waiting" && "Задачи, которые ждут назначения исполнителя"}
                        {activeTopTab === "active" && "Задачи, которые сейчас в работе"}
                        {activeTopTab === "archived" && "Завершённые и архивные задачи"}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {visibleTasks.map((task) => (
                          <TaskCard key={task.id} task={task} />
                        ))}
                      </AnimatePresence>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-white/40">
                    Экран «{bottomTabs.find((item) => item.key === activeBottomTab)?.label}» будет следующим шагом.
                  </div>
                )}
              </div>

              <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-white/8 bg-[#0b0b10]/95 px-3 pb-4 pt-3 backdrop-blur-xl">
                <div className="grid grid-cols-5 gap-1">
                  {bottomTabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeBottomTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setActiveBottomTab(tab.key)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 transition",
                          active ? "bg-[#56FFEF]/15 text-[#56FFEF]" : "text-white/45 hover:bg-white/[0.04]"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px] leading-none">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
