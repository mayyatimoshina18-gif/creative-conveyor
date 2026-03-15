import React, { useEffect, useMemo, useState } from "react";
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

type Task = {
  id: number;
  title: string;
  type: string[];
  deadline: string;
  price: string;
  manager: string;
};

type TasksResponse = {
  waiting: Task[];
  active: Task[];
  archived: Task[];
};

const API_BASE = "https://creative-conveyor-backend.onrender.com";

const SPECIALIZATION_OPTIONS = ["Статика", "Моушен", "Лендинги"];

const topTabs = [
  { key: "waiting", label: "Ждут исполнителя", icon: CircleDot },
  { key: "active", label: "Активные", icon: Clock3 },
  { key: "archived", label: "Архивные", icon: Archive }
] as const;

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

function TaskCard({ task }: { task: Task }) {
  return (
    <motion.div
      layout
      className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4"
    >
      <div className="mb-2 text-xs text-white/35">Задача #{task.id}</div>
      <div className="text-base font-semibold">{task.title}</div>
      <div className="text-sm text-white/55 mt-2">Менеджер: {task.manager}</div>
    </motion.div>
  );
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-base text-white outline-none placeholder:text-white/25"
    />
  );
}

export default function App() {

  const [screen, setScreen] = useState<
    | "welcome"
    | "managerPassword"
    | "managerApp"
    | "executorLoading"
    | "executorRegister"
    | "executorPending"
    | "executorApp"
  >("welcome");

  const [executor, setExecutor] = useState<any>(null);

  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [activeTopTab, setActiveTopTab] =
    useState<"waiting" | "active" | "archived">("waiting");

  const [activeBottomTab, setActiveBottomTab] = useState("tasks");

  const [tasksData, setTasksData] = useState<TasksResponse>({
    waiting: [],
    active: [],
    archived: []
  });

  const visibleTasks = useMemo(
    () => tasksData[activeTopTab] || [],
    [tasksData, activeTopTab]
  );

  useEffect(() => {
    const telegram = (window as any)?.Telegram?.WebApp;
    telegram?.ready?.();
  }, []);

  async function loadExecutor() {
    try {
      const telegram = (window as any)?.Telegram?.WebApp;
      const user = telegram?.initDataUnsafe?.user;

      if (!user?.id) {
        setScreen("executorRegister");
        return;
      }

      const res = await fetch(`${API_BASE}/api/executors/me`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          telegramId: user.id
        })
      });

      if (res.status === 404) {
        setScreen("executorRegister");
        return;
      }

      const data = await res.json();

      setExecutor(data.executor);

      if (data.executor.status === "На модерации") {
        setScreen("executorPending");
        return;
      }

      if (data.executor.status === "Подтверждён") {
        setScreen("executorApp");
        return;
      }

      setScreen("executorRegister");
    } catch (e) {
      console.error(e);
      setScreen("executorRegister");
    }
  }

  const handleManagerLogin = () => {
    if (!password.trim()) {
      setPasswordError("Введи пароль");
      return;
    }

    setPasswordError("");
    setScreen("managerApp");
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white">

      <AnimatePresence mode="wait">

        {screen === "welcome" && (
          <motion.div key="welcome" className="p-6">
            <h1 className="text-3xl font-semibold mb-6">
              Креативный конвейер ЛЭНД
            </h1>

            <div className="space-y-3">
              <RoleButton
                label="Я менеджер"
                onClick={() => setScreen("managerPassword")}
              />

              <RoleButton
                label="Я исполнитель"
                onClick={() => {
                  setScreen("executorLoading");
                  loadExecutor();
                }}
              />
            </div>
          </motion.div>
        )}

        {screen === "executorLoading" && (
          <motion.div key="executorLoading" className="p-6 text-center">
            Проверяем ваш аккаунт исполнителя...
          </motion.div>
        )}

        {screen === "executorRegister" && (
          <motion.div key="executorRegister" className="p-6">
            <h2 className="text-xl mb-4">Регистрация исполнителя</h2>

            <p className="text-white/50">
              Вы ещё не зарегистрированы как исполнитель.
            </p>

            <button
              onClick={() => setScreen("welcome")}
              className="mt-6 bg-[#56FFEF] text-black px-5 py-3 rounded-xl"
            >
              Назад
            </button>
          </motion.div>
        )}

        {screen === "executorPending" && (
          <motion.div key="executorPending" className="p-6">
            <h2 className="text-xl mb-4">Анкета на модерации</h2>

            <p className="text-white/50 mb-6">
              Менеджер проверяет вашу анкету.
            </p>

            <div className="bg-white/5 p-4 rounded-xl">
              ID исполнителя: {executor?.executorCode}
            </div>
          </motion.div>
        )}

        {screen === "executorApp" && (
          <motion.div key="executorApp" className="p-6">
            <h2 className="text-xl mb-6">Кабинет исполнителя</h2>

            <div className="space-y-3">

              <div className="bg-white/5 p-4 rounded-xl">
                ID исполнителя: {executor?.executorCode}
              </div>

              <div className="bg-white/5 p-4 rounded-xl">
                Контакт: {executor?.telegramContact}
              </div>

              <div className="bg-white/5 p-4 rounded-xl">
                Статус: {executor?.status}
              </div>

            </div>
          </motion.div>
        )}

        {screen === "managerPassword" && (
          <motion.div key="managerPassword" className="p-6">

            <button
              onClick={() => setScreen("welcome")}
              className="mb-6 text-white/60"
            >
              Назад
            </button>

            <FormInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль менеджера"
            />

            {passwordError && (
              <div className="text-red-400 mt-2">{passwordError}</div>
            )}

            <button
              onClick={handleManagerLogin}
              className="mt-4 w-full bg-[#56FFEF] text-black py-4 rounded-3xl"
            >
              Войти
            </button>
          </motion.div>
        )}

        {screen === "managerApp" && (
          <motion.div key="managerApp" className="p-6">

            <h2 className="text-2xl mb-6">Задачи</h2>

            <div className="space-y-3">
              {visibleTasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>

          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
