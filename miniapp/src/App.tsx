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
  status?: string;
  assignedExecutorId?: number | null;
  assignedExecutorName?: string | null;
  assignedExecutorContact?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
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

function TaskCard({ task }: { task: Task }) {
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
          <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/35">
            Задача #{task.id}
          </div>
          <div className="text-base font-semibold leading-5 text-white">
            {task.title}
          </div>
        </div>
        <button className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
          Открыть
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(task.type || []).map((item) => (
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
          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">
            Дедлайн
          </div>
          <div>{task.deadline || "—"}</div>
        </div>
        <div className="rounded-2xl bg-black/20 p-3">
          <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-white/35">
            Стоимость
          </div>
          <div>{task.price || "—"}</div>
        </div>
      </div>

      <div className="mt-3 text-sm text-white/55">Менеджер: {task.manager || "—"}</div>
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
  const [screen, setScreen] = useState<"welcome" | "managerPassword" | "managerApp">("welcome");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [activeTopTab, setActiveTopTab] = useState<"waiting" | "active" | "archived">("waiting");
  const [activeBottomTab, setActiveBottomTab] = useState("tasks");

  const [tasksData, setTasksData] = useState<TasksResponse>({
    waiting: [],
    active: [],
    archived: []
  });
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState("");

  const [createTitle, setCreateTitle] = useState("");
  const [createCategories, setCreateCategories] = useState<string[]>([]);
  const [createDeadlineDate, setCreateDeadlineDate] = useState("");
  const [createDeadlineTime, setCreateDeadlineTime] = useState("");
  const [createPrice, setCreatePrice] = useState("");
  const [createManagerContact, setCreateManagerContact] = useState("@YYT1M");
  const [createComment, setCreateComment] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const visibleTasks = useMemo(() => tasksData[activeTopTab] || [], [tasksData, activeTopTab]);

  const loadTasks = async () => {
    try {
      setIsLoadingTasks(true);
      setTasksError("");

      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: "GET"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: TasksResponse = await response.json();

      setTasksData({
        waiting: Array.isArray(data.waiting) ? data.waiting : [],
        active: Array.isArray(data.active) ? data.active : [],
        archived: Array.isArray(data.archived) ? data.archived : []
      });
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setTasksError("Не удалось загрузить задачи с сервера");
    } finally {
      setIsLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (screen === "managerApp") {
      void loadTasks();
    }
  }, [screen]);

  const handleManagerLogin = () => {
    if (!password.trim()) {
      setPasswordError("Введи пароль менеджера");
      return;
    }
    setPasswordError("");
    setScreen("managerApp");
  };

  const toggleCategory = (category: string) => {
    setCreateCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
  };

  const resetCreateForm = () => {
    setCreateTitle("");
    setCreateCategories([]);
    setCreateDeadlineDate("");
    setCreateDeadlineTime("");
    setCreatePrice("");
    setCreateComment("");
    setCreateError("");
    setCreateSuccess("");
  };

  const handleCreateTask = async () => {
    if (!createTitle.trim()) {
      setCreateError("Введите название задачи");
      return;
    }

    if (!createCategories.length) {
      setCreateError("Выберите хотя бы одну категорию");
      return;
    }

    if (!createDeadlineDate.trim()) {
      setCreateError("Введите дату дедлайна");
      return;
    }

    if (!createDeadlineTime.trim()) {
      setCreateError("Введите время дедлайна");
      return;
    }

    if (!createPrice.trim()) {
      setCreateError("Введите стоимость");
      return;
    }

    if (!createManagerContact.trim()) {
      setCreateError("Введите контакт менеджера");
      return;
    }

    try {
      setIsCreating(true);
      setCreateError("");
      setCreateSuccess("");

      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          managerId: 0,
          managerUsername: null,
          managerContact: createManagerContact.trim(),
          title: createTitle.trim(),
          categories: createCategories,
          deadlineDate: createDeadlineDate.trim(),
          deadlineTime: createDeadlineTime.trim(),
          price: createPrice.trim(),
          comment: createComment.trim() || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to create task");
      }

      setCreateSuccess("Задача создана");
      resetCreateForm();
      await loadTasks();
      setActiveBottomTab("tasks");
      setActiveTopTab("waiting");
    } catch (error) {
      console.error("Failed to create task:", error);
      setCreateError("Не удалось создать задачу");
    } finally {
      setIsCreating(false);
    }
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
                <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">
                  Вход менеджера
                </h2>
                <p className="mt-2 text-sm text-white/45">
                  Введи пароль, чтобы открыть менеджерский интерфейс
                </p>
              </div>

              <div className="space-y-3">
                <FormInput
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль"
                />
                {passwordError ? (
                  <div className="px-1 text-sm text-rose-300">{passwordError}</div>
                ) : null}
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
                    <div className="text-xs uppercase tracking-[0.18em] text-white/35">
                      Креативный конвейер ЛЭНД
                    </div>
                    <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-white">
                      {activeBottomTab === "create" ? "Создать задачу" : "Задачи"}
                    </div>
                  </div>
                  <button
                    onClick={() => void loadTasks()}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                </div>

                {activeBottomTab === "tasks" && (
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
                )}
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

                    {isLoadingTasks ? (
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
                        Загружаю задачи...
                      </div>
                    ) : tasksError ? (
                      <div className="space-y-3">
                        <div className="rounded-3xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">
                          {tasksError}
                        </div>
                        <button
                          onClick={() => void loadTasks()}
                          className="rounded-2xl bg-[#56FFEF] px-4 py-3 text-sm font-medium text-black"
                        >
                          Повторить загрузку
                        </button>
                      </div>
                    ) : visibleTasks.length === 0 ? (
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/45">
                        Здесь пока нет задач.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                          {visibleTasks.map((task) => (
                            <TaskCard key={task.id} task={task} />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </>
                ) : activeBottomTab === "create" ? (
                  <div className="space-y-3">
                    <FormInput
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
                      placeholder="Название задачи"
                    />

                    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
                      <div className="mb-3 text-sm text-white/55">Категории</div>
                      <div className="flex flex-wrap gap-2">
                        {SPECIALIZATION_OPTIONS.map((item) => {
                          const active = createCategories.includes(item);

                          return (
                            <button
                              key={item}
                              onClick={() => toggleCategory(item)}
                              className={cn(
                                "rounded-full border px-3 py-2 text-sm transition",
                                active
                                  ? "border-[#56FFEF]/20 bg-[#56FFEF]/15 text-[#56FFEF]"
                                  : "border-white/10 bg-white/5 text-white/65"
                              )}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <FormInput
                      type="date"
                      value={createDeadlineDate}
                      onChange={(e) => setCreateDeadlineDate(e.target.value)}
                      placeholder="Дата дедлайна"
                    />

                    <FormInput
                      type="time"
                      value={createDeadlineTime}
                      onChange={(e) => setCreateDeadlineTime(e.target.value)}
                      placeholder="Время дедлайна"
                    />

                    <FormInput
                      value={createPrice}
                      onChange={(e) => setCreatePrice(e.target.value)}
                      placeholder="Стоимость"
                    />

                    <FormInput
                      value={createManagerContact}
                      onChange={(e) => setCreateManagerContact(e.target.value)}
                      placeholder="Контакт менеджера"
                    />

                    <FormInput
                      value={createComment}
                      onChange={(e) => setCreateComment(e.target.value)}
                      placeholder="Комментарий (необязательно)"
                    />

                    {createError ? (
                      <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200">
                        {createError}
                      </div>
                    ) : null}

                    {createSuccess ? (
                      <div className="rounded-2xl border border-[#56FFEF]/20 bg-[#56FFEF]/10 p-4 text-sm text-[#56FFEF]">
                        {createSuccess}
                      </div>
                    ) : null}

                    <button
                      onClick={handleCreateTask}
                      disabled={isCreating}
                      className="w-full rounded-3xl bg-[#56FFEF] px-5 py-4 text-base font-medium text-black transition hover:brightness-95 disabled:opacity-60"
                    >
                      {isCreating ? "Создаю..." : "Создать задачу"}
                    </button>
                  </div>
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
