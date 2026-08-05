"use client";

import {
  Archive,
  CalendarDays,
  Check,
  ClipboardList,
  Edit3,
  Flag,
  Heart,
  Home,
  Image as ImageIcon,
  Inbox,
  ListChecks,
  LogOut,
  Moon,
  PenLine,
  Plus,
  Repeat2,
  Settings,
  Sparkles,
  Target,
  Trophy,
  Undo2,
  X,
  type LucideIcon
} from "lucide-react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AiDreamSuggestionOutput } from "../lib/aiDream";
import type { TodayAiSuggestionInput, TodayAiSuggestionOutput } from "../lib/aiToday";
import type { WeeklyReviewInput, WeeklyReviewOutput } from "../lib/aiWeekly";

type DateValue = string | null;

type Dream = {
  id: string;
  user_id: string;
  title: string;
  reason: string;
  deadline: DateValue;
  category: string;
  desired_state: string;
  status: "active" | "achieved" | "paused";
  priority: number;
  created_at: string;
  updated_at: string;
};

type Goal = {
  id: string;
  user_id: string;
  dream_id: string | null;
  parent_goal_id?: string | null;
  title: string;
  description: string;
  level: GoalLevel;
  category?: string | null;
  deadline: DateValue;
  status: "todo" | "doing" | "done" | "archived";
  created_at: string;
  updated_at: string;
};

type Task = {
  id: string;
  user_id: string;
  dream_id: string | null;
  goal_id: string | null;
  title: string;
  memo: string;
  due_date: DateValue;
  urgent: boolean;
  important: boolean;
  status: "todo" | "doing" | "done" | "archived";
  completed_at: string | null;
  reschedule_count?: number;
  last_rescheduled_at?: string | null;
  rescheduled_from?: DateValue;
  rescheduled_to?: DateValue;
  reschedule_history?: RescheduleHistoryItem[];
  recurrence_type?: RecurrenceType;
  recurrence_weekdays?: number[];
  recurrence_day_of_month?: number | null;
  recurrence_start_date?: DateValue;
  recurrence_active?: boolean;
  created_at: string;
  updated_at: string;
};

type RescheduleDestination = "tomorrow" | "this_week" | "next_week" | "this_month" | "custom" | "hold" | "drop";
type RecurrenceType = "none" | "daily" | "weekdays" | "weekly" | "monthly";
type RolloverMode = "tomorrow" | "this_week" | "individual" | "none";

type RescheduleHistoryItem = {
  rescheduled_at: string;
  from_due_date: DateValue;
  to_due_date: DateValue;
  destination: RescheduleDestination;
};

type TaskCompletionRecord = {
  id: string;
  user_id: string;
  task_id: string;
  completion_date: string;
  completed_at: string;
  title_snapshot: string;
  dream_id: string | null;
  goal_id: string | null;
  urgent: boolean;
  important: boolean;
  created_at: string;
  updated_at: string;
};

type MotivationCard = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  kind: "principle" | "dream" | "family" | "reason" | "future" | "words" | "photo";
  image_url: string;
  sort_order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
};

type InboxItem = {
  id: string;
  user_id: string;
  title: string;
  memo: string;
  kind: "someday" | "idea" | "thought";
  status: "open" | "archived";
  created_at: string;
  updated_at: string;
};

type Reflection = {
  id: string;
  user_id: string;
  reflection_date: string;
  done_text: string;
  not_done_text: string;
  dream_progress_text: string;
  tomorrow_text: string;
  insight_text: string;
  satisfaction_score: number;
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

type AiSuggestionRecord = {
  id: string;
  user_id: string;
  dream_id: string | null;
  input_snapshot: Record<string, unknown>;
  output_json: AiDreamSuggestionOutput;
  status: "pending" | "accepted" | "partially_accepted" | "rejected";
  created_at: string;
  updated_at: string;
};

type TodayAiSuggestionRecord = {
  id: string;
  user_id: string;
  suggestion_date: string;
  context_hash: string;
  input_snapshot: TodayAiSuggestionInput;
  output_json: TodayAiSuggestionOutput;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

type WeeklyAiReviewRecord = {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  context_hash: string;
  input_snapshot: WeeklyReviewInput;
  output_json: WeeklyReviewOutput;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

type AppData = {
  dreams: Dream[];
  goals: Goal[];
  tasks: Task[];
  inbox: InboxItem[];
  aiSuggestions: AiSuggestionRecord[];
  todayAiSuggestions: TodayAiSuggestionRecord[];
  weeklyAiReviews: WeeklyAiReviewRecord[];
  reflections: Reflection[];
  taskCompletionRecords: TaskCompletionRecord[];
  motivationCards: MotivationCard[];
  profile: Profile;
};

type CollectionKey =
  | "dreams"
  | "goals"
  | "tasks"
  | "inbox"
  | "aiSuggestions"
  | "todayAiSuggestions"
  | "weeklyAiReviews"
  | "reflections"
  | "taskCompletionRecords"
  | "motivationCards";
type Tab = "home" | "dreams" | "goals" | "tasks" | "matrix" | "inbox" | "reflect" | "settings";
type Notice = { type: "success" | "error"; message: string; actionLabel?: string; onAction?: () => void };
type GoalLevel = "twenty_year" | "ten_year" | "five_year" | "one_year" | "monthly" | "weekly" | "daily" | "three_year";

const now = () => new Date().toISOString();
const localUserId = "local-user";
const storageKey = "ai-dream-note-phase1";
const journalDateKey = `${storageKey}:current-journal-date`;

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function systemJournalDate(date = new Date()) {
  const local = new Date(date);
  if (local.getHours() < 3) local.setDate(local.getDate() - 1);
  return formatLocalDate(local);
}

function storedJournalDate() {
  const systemDate = systemJournalDate();
  if (typeof window === "undefined") return systemDate;
  const stored = window.localStorage.getItem(journalDateKey);
  if (!stored) {
    window.localStorage.setItem(journalDateKey, systemDate);
    return systemDate;
  }
  return stored;
}

const today = () => storedJournalDate();

const dreamPillars = ["仕事", "家庭", "健康", "趣味", "教養", "財産"] as const;
type DreamPillar = (typeof dreamPillars)[number];
const uncategorizedPillar = "未分類";

const legacyCategoryToPillar: Record<string, DreamPillar> = {
  お金: "財産",
  家族: "家庭",
  学習: "教養"
};

function isDreamPillar(value?: string | null): value is DreamPillar {
  return dreamPillars.includes(value as DreamPillar);
}

function displayDreamPillar(category?: string | null) {
  if (isDreamPillar(category)) return category;
  if (category && legacyCategoryToPillar[category]) return legacyCategoryToPillar[category];
  return uncategorizedPillar;
}

function parentGoalId(goal: Goal) {
  return goal.parent_goal_id ?? null;
}

function sortGoalsByPlan(a: Goal, b: Goal) {
  return goalLevelOrder[a.level] - goalLevelOrder[b.level] || dateDistance(a.deadline) - dateDistance(b.deadline) || a.created_at.localeCompare(b.created_at);
}

const newGoalLevels = ["twenty_year", "ten_year", "five_year", "one_year", "monthly", "weekly"] as const;
const homeGoalLevels = ["weekly", "monthly", "one_year", "five_year", "ten_year", "twenty_year"] as const;
const legacyGoalLevels = ["three_year", "daily"] as const;

const goalLabels: Record<GoalLevel, string> = {
  twenty_year: "20年後",
  ten_year: "10年後",
  five_year: "5年計画",
  one_year: "1年目標",
  monthly: "今月目標",
  weekly: "今週目標",
  daily: "旧・今日の行動",
  three_year: "旧3年目標"
};

const goalLevelOrder: Record<GoalLevel, number> = {
  twenty_year: 1,
  ten_year: 2,
  five_year: 3,
  one_year: 4,
  monthly: 5,
  weekly: 6,
  daily: 7,
  three_year: 0
};

const parentGoalLevelsByLevel: Record<GoalLevel, GoalLevel[]> = {
  twenty_year: [],
  ten_year: ["twenty_year"],
  five_year: ["ten_year", "twenty_year", "three_year"],
  one_year: ["five_year", "ten_year", "twenty_year", "three_year"],
  monthly: ["one_year", "five_year", "ten_year", "twenty_year", "three_year"],
  weekly: ["monthly", "one_year", "five_year", "ten_year", "twenty_year", "three_year"],
  daily: ["weekly", "monthly", "one_year", "five_year", "ten_year", "twenty_year", "three_year"],
  three_year: ["ten_year", "five_year", "twenty_year"]
};

function nextPlanStep(level: GoalLevel): GoalLevel | "task" | null {
  if (level === "twenty_year") return "ten_year";
  if (level === "ten_year") return "five_year";
  if (level === "five_year" || level === "three_year") return "one_year";
  if (level === "one_year") return "monthly";
  if (level === "monthly") return "weekly";
  if (level === "weekly" || level === "daily") return "task";
  return null;
}

function parseLineItems(values: FormDataEntryValue | FormDataEntryValue[] | null) {
  const rawValues = Array.isArray(values) ? values : [values ?? ""];
  return rawValues
    .flatMap((value) => String(value).split(/\r?\n/))
    .map((item) => item.trim().replace(/^[-・\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const inboxKindLabels: Record<InboxItem["kind"], string> = {
  someday: "いつか",
  idea: "アイデア",
  thought: "気づき"
};

const recurrenceLabels: Record<RecurrenceType, string> = {
  none: "なし",
  daily: "毎日",
  weekdays: "曜日指定",
  weekly: "毎週",
  monthly: "毎月"
};

const motivationKindLabels: Record<MotivationCard["kind"], string> = {
  principle: "人生理念",
  dream: "夢",
  family: "家族",
  reason: "理由",
  future: "未来",
  words: "言葉",
  photo: "写真"
};

const navItems: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "ホーム", icon: Home },
  { key: "goals", label: "目標", icon: Target },
  { key: "tasks", label: "タスク", icon: Plus },
  { key: "reflect", label: "振返り", icon: Moon },
  { key: "settings", label: "設定", icon: Settings }
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
const supabase: SupabaseClient | null = hasSupabaseConfig ? createClient(supabaseUrl!, supabaseAnonKey!) : null;

const emptyProfile = (): Profile => ({
  id: crypto.randomUUID(),
  user_id: localUserId,
  display_name: "Kobe",
  created_at: now(),
  updated_at: now()
});

const initialData = (): AppData => ({
  profile: emptyProfile(),
  dreams: [],
  goals: [],
  tasks: [],
  inbox: [],
  aiSuggestions: [],
  todayAiSuggestions: [],
  weeklyAiReviews: [],
  reflections: [],
  taskCompletionRecords: [],
  motivationCards: []
});

function normalizeDate(value: FormDataEntryValue | null): DateValue | "invalid" {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalized = text.replace(/[/.]/g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "invalid";
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return "invalid";
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeId(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function getStoredData() {
  if (typeof window === "undefined") return initialData();
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return initialData();
  try {
    const parsed = JSON.parse(saved) as Partial<AppData>;
    const base = initialData();
    return {
      ...base,
      ...parsed,
      dreams: parsed.dreams ?? [],
      goals: parsed.goals ?? [],
      tasks: parsed.tasks ?? [],
      inbox: parsed.inbox ?? [],
      aiSuggestions: parsed.aiSuggestions ?? [],
      todayAiSuggestions: parsed.todayAiSuggestions ?? [],
      weeklyAiReviews: parsed.weeklyAiReviews ?? [],
      reflections: parsed.reflections ?? [],
      taskCompletionRecords: parsed.taskCompletionRecords ?? [],
      motivationCards: parsed.motivationCards ?? [],
      profile: { ...base.profile, ...parsed.profile }
    } satisfies AppData;
  } catch {
    return initialData();
  }
}

function dateDistance(date: DateValue) {
  return dateDistanceFrom(date, today());
}

function dateDistanceFrom(date: DateValue, baseDate: string) {
  if (!date) return 9999;
  const day = new Date(`${date}T00:00:00`).getTime();
  const base = new Date(`${baseDate}T00:00:00`).getTime();
  return Math.ceil((day - base) / 86400000);
}

function dueLabel(date: DateValue) {
  const distance = dateDistance(date);
  if (!date || distance > 999) return "期限未設定";
  if (distance < 0) return `期限切れ ${Math.abs(distance)}日`;
  if (distance === 0) return "今日";
  if (distance <= 3) return `あと${distance}日`;
  return date;
}

function matrixLabel(task: Task) {
  if (task.urgent && task.important) return "第Ⅰ領域 重要・緊急";
  if (!task.urgent && task.important) return "第Ⅱ領域 重要・緊急でない";
  if (task.urgent && !task.important) return "第Ⅲ領域 緊急・重要でない";
  return "第Ⅳ領域 重要でも緊急でもない";
}

function matrixBadgeClass(task: Task) {
  if (!task.urgent && task.important) return "bg-leaf/20 text-moss ring-1 ring-leaf/25";
  if (task.urgent && task.important) return "bg-dawn/25 text-clay";
  return "bg-mist text-moss";
}

function simpleHash(text: string) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33) ^ text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function addDays(date: string, days: number) {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function weekBounds(date = today()) {
  const base = new Date(`${date}T00:00:00`);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + mondayOffset);
  const weekStart = base.toISOString().slice(0, 10);
  return { weekStart, weekEnd: addDays(weekStart, 6) };
}

function monthEnd(date = today()) {
  const base = new Date(`${date}T00:00:00`);
  return new Date(base.getFullYear(), base.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function nextWeekStart(date = today()) {
  return addDays(weekBounds(date).weekEnd, 1);
}

function taskRescheduleCount(task: Task) {
  return task.reschedule_count ?? task.reschedule_history?.length ?? 0;
}

function taskRecurrenceType(task: Task): RecurrenceType {
  return task.recurrence_type ?? "none";
}

function isRecurringTask(task: Task) {
  return taskRecurrenceType(task) !== "none" && task.recurrence_active !== false;
}

function isTaskCompletedOn(taskId: string, date: string, records: TaskCompletionRecord[]) {
  return records.some((record) => record.task_id === taskId && record.completion_date === date);
}

function isTaskEffectivelyDone(task: Task, records: TaskCompletionRecord[]) {
  return task.status === "done" || records.some((record) => record.task_id === task.id);
}

function goalProgress(goal: Goal, goals: Goal[], tasks: Task[], records: TaskCompletionRecord[]) {
  const childGoals = goals.filter((child) => child.status !== "archived" && parentGoalId(child) === goal.id);
  const childTasks = tasks.filter((task) => task.status !== "archived" && task.goal_id === goal.id);
  const doneGoals = childGoals.filter((child) => child.status === "done").length;
  const doneTasks = childTasks.filter((task) => isTaskEffectivelyDone(task, records)).length;
  const total = childGoals.length + childTasks.length;
  const done = doneGoals + doneTasks;
  return { childGoals, childTasks, done, total };
}

function goalAncestors(goalId: string | null | undefined, goals: Goal[]) {
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));
  const ancestors: Goal[] = [];
  const seen = new Set<string>();
  let current = goalId ? goalById.get(goalId) : undefined;
  while (current && !seen.has(current.id)) {
    ancestors.push(current);
    seen.add(current.id);
    current = parentGoalId(current) ? goalById.get(parentGoalId(current) ?? "") : undefined;
  }
  return ancestors;
}

function goalDescendantIds(goalId: string, goals: Goal[]) {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const goal of goals) {
      const parentId = parentGoalId(goal);
      if (parentId === goalId || (parentId && descendants.has(parentId))) {
        if (!descendants.has(goal.id)) {
          descendants.add(goal.id);
          changed = true;
        }
      }
    }
  }
  return descendants;
}

function reconcileGoalStatuses(goals: Goal[], tasks: Task[], records: TaskCompletionRecord[], startGoalId: string | null | undefined) {
  if (!startGoalId) return goals;
  const targetIds = goalAncestors(startGoalId, goals).map((goal) => goal.id);
  if (targetIds.length === 0) return goals;
  let nextGoals = goals;
  for (const goalId of targetIds) {
    const goal = nextGoals.find((item) => item.id === goalId);
    if (!goal || goal.status === "archived") continue;
    const progress = goalProgress(goal, nextGoals, tasks, records);
    if (progress.total === 0) continue;
    const nextStatus: Goal["status"] = progress.done >= progress.total ? "done" : goal.status === "done" ? "todo" : goal.status;
    if (nextStatus !== goal.status) {
      nextGoals = nextGoals.map((item) => (item.id === goal.id ? { ...item, status: nextStatus, updated_at: now() } : item));
    }
  }
  return nextGoals;
}

function changedGoals(before: Goal[], after: Goal[]) {
  const beforeById = new Map(before.map((goal) => [goal.id, goal]));
  return after.filter((goal) => {
    const previous = beforeById.get(goal.id);
    return previous && (previous.status !== goal.status || previous.updated_at !== goal.updated_at);
  });
}

function timeInputValue(isoValue: string) {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "09:00";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isRecurringTaskDueOn(task: Task, date: string) {
  if (!isRecurringTask(task)) return false;
  const startDate = task.recurrence_start_date ?? task.due_date ?? task.created_at.slice(0, 10);
  if (startDate && date < startDate) return false;
  const target = new Date(`${date}T00:00:00`);
  const weekday = target.getDay();
  const dayOfMonth = target.getDate();
  const recurrenceType = taskRecurrenceType(task);
  if (recurrenceType === "daily") return true;
  if (recurrenceType === "weekdays") return (task.recurrence_weekdays?.length ? task.recurrence_weekdays : [1, 2, 3, 4, 5]).includes(weekday);
  if (recurrenceType === "weekly") return weekday === new Date(`${startDate}T00:00:00`).getDay();
  if (recurrenceType === "monthly") return dayOfMonth === (task.recurrence_day_of_month ?? new Date(`${startDate}T00:00:00`).getDate());
  return false;
}

function completionRecordId(taskId: string, date: string) {
  return `${taskId}-${date}`;
}

function futureOrTomorrow(date: string) {
  return dateDistance(date) > 0 ? date : addDays(today(), 1);
}

function sanitizeForDatabase<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value === "" || value === undefined ? null : value])
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [data, setData] = useState<AppData>(initialData);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editingDreamId, setEditingDreamId] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingInboxId, setEditingInboxId] = useState<string | null>(null);
  const [editingMotivationCardId, setEditingMotivationCardId] = useState<string | null>(null);
  const [reschedulingTaskId, setReschedulingTaskId] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<Partial<Goal> | null>(null);
  const [selectedGoalLevel, setSelectedGoalLevel] = useState<GoalLevel | null>(null);
  const [taskDraft, setTaskDraft] = useState<Partial<Task> | null>(null);
  const [dreamFormVersion, setDreamFormVersion] = useState(0);
  const [goalFormVersion, setGoalFormVersion] = useState(0);
  const [taskFormVersion, setTaskFormVersion] = useState(0);
  const [inboxFormVersion, setInboxFormVersion] = useState(0);
  const [motivationCardFormVersion, setMotivationCardFormVersion] = useState(0);
  const [aiLoadingDreamId, setAiLoadingDreamId] = useState<string | null>(null);
  const [aiTodayLoading, setAiTodayLoading] = useState(false);
  const [aiWeeklyLoading, setAiWeeklyLoading] = useState(false);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [journalDate, setJournalDate] = useState(() => systemJournalDate());
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [reflectionDirty, setReflectionDirty] = useState(false);
  const rolloverUndoRef = useRef<{ data: AppData; journalDate: string } | null>(null);

  const userId = user?.id ?? localUserId;
  const cloudMode = Boolean(supabase && user);
  const editingDream = data.dreams.find((dream) => dream.id === editingDreamId);
  const editingGoal = data.goals.find((goal) => goal.id === editingGoalId);
  const editingTask = data.tasks.find((task) => task.id === editingTaskId);
  const editingInboxItem = data.inbox.find((item) => item.id === editingInboxId);
  const editingMotivationCard = data.motivationCards.find((card) => card.id === editingMotivationCardId);
  const reschedulingTask = data.tasks.find((task) => task.id === reschedulingTaskId);
  const activeGoals = data.goals.filter((goal) => goal.status !== "archived");
  const linkableDreams = data.dreams.filter((dream) => dream.status === "active");

  useEffect(() => {
    setData(getStoredData());
    setJournalDate(storedJournalDate());
    setLoaded(true);

    if (!supabase) return;
    supabase.auth.getUser().then(({ data: session }) => setUser(session.user));
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const syncJournalDate = () => {
      const systemDate = systemJournalDate();
      const stored = window.localStorage.getItem(journalDateKey);
      const before = stored ?? systemDate;
      const next = before < systemDate ? systemDate : before;
      if (!stored || stored < systemDate) window.localStorage.setItem(journalDateKey, next);
      if (next !== before || next !== journalDate) {
        setJournalDate(next);
        const previousUnfinished = data.tasks.filter(
          (task) =>
            task.status !== "done" &&
            task.status !== "archived" &&
            !isRecurringTask(task) &&
            task.due_date === before
        ).length;
        if (next > before && previousUnfinished > 0) {
          setNotice({
            type: "success",
            message: `昨日の未完了が${previousUnfinished}件あります。振り返りから整理できます。`
          });
        }
      }
    };
    syncJournalDate();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncJournalDate();
    };
    const timer = window.setInterval(syncJournalDate, 60000);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loaded, journalDate, data.tasks]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      setNotice({ type: "error", message: "ローカル保存に失敗しました。ブラウザの空き容量や権限を確認してください。" });
    }
  }, [data, loaded]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!supabase || !user) return;
    void loadRemoteData(user.id, user.email);
  }, [user]);

  useEffect(() => {
    if (notice?.type !== "success") return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function loadRemoteData(activeUserId: string, email?: string) {
    if (!supabase) return;
    try {
      const [
        dreams,
        goals,
        tasks,
        inboxItems,
        aiSuggestions,
        todayAiSuggestions,
        weeklyAiReviews,
        reflections,
        taskCompletionRecords,
        motivationCards,
        profiles
      ] = await Promise.all([
        supabase.from("dreams").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("goals").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("inbox_items").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("ai_suggestions").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("today_ai_suggestions").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("weekly_ai_reviews").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("daily_reflections").select("*").eq("user_id", activeUserId).order("reflection_date", { ascending: false }),
        supabase.from("task_completion_records").select("*").eq("user_id", activeUserId).order("completed_at", { ascending: false }),
        supabase.from("motivation_cards").select("*").eq("user_id", activeUserId).order("sort_order", { ascending: true }),
        supabase.from("profiles").select("*").eq("user_id", activeUserId).maybeSingle()
      ]);
      const firstError = [
        dreams,
        goals,
        tasks,
        inboxItems,
        aiSuggestions,
        todayAiSuggestions,
        weeklyAiReviews,
        reflections,
        taskCompletionRecords,
        motivationCards,
        profiles
      ].find((result) => result.error)?.error;
      if (firstError) {
        setNotice({ type: "error", message: `クラウド読込に失敗しました: ${firstError.message}` });
      }
      setData({
        dreams: (dreams.data ?? []) as Dream[],
        goals: (goals.data ?? []) as Goal[],
        tasks: (tasks.data ?? []) as Task[],
        inbox: (inboxItems.data ?? []) as InboxItem[],
        aiSuggestions: (aiSuggestions.data ?? []) as AiSuggestionRecord[],
        todayAiSuggestions: (todayAiSuggestions.data ?? []) as TodayAiSuggestionRecord[],
        weeklyAiReviews: (weeklyAiReviews.data ?? []) as WeeklyAiReviewRecord[],
        reflections: (reflections.data ?? []) as Reflection[],
        taskCompletionRecords: (taskCompletionRecords.data ?? []) as TaskCompletionRecord[],
        motivationCards: (motivationCards.data ?? []) as MotivationCard[],
        profile:
          ((profiles.data as Profile | null) ??
            ({
              ...emptyProfile(),
              user_id: activeUserId,
              display_name: email?.split("@")[0] ?? "Me"
            } satisfies Profile))
      });
    } catch (error) {
      setNotice({ type: "error", message: `クラウド読込に失敗しました: ${error instanceof Error ? error.message : "原因不明"}` });
    }
  }

  async function persist<T extends { id: string }>(table: string, record: T) {
    if (!cloudMode || !supabase) return true;
    try {
      const { error } = await supabase.from(table).upsert(sanitizeForDatabase(record));
      if (error) {
        setNotice({ type: "error", message: `クラウド保存に失敗しました: ${error.message}` });
        return false;
      }
      return true;
    } catch (error) {
      setNotice({ type: "error", message: `クラウド保存に失敗しました: ${error instanceof Error ? error.message : "原因不明"}` });
      return false;
    }
  }

  async function deleteRemote(table: string, id: string) {
    if (!cloudMode || !supabase) return true;
    try {
      const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", userId);
      if (error) {
        setNotice({ type: "error", message: `クラウド削除に失敗しました: ${error.message}` });
        return false;
      }
      return true;
    } catch (error) {
      setNotice({ type: "error", message: `クラウド削除に失敗しました: ${error instanceof Error ? error.message : "原因不明"}` });
      return false;
    }
  }

  function upsertLocal<K extends CollectionKey>(key: K, record: AppData[K][number]) {
    setData((current) => {
      const list = current[key] as Array<{ id: string }>;
      const nextList = list.some((item) => item.id === record.id)
        ? list.map((item) => (item.id === record.id ? record : item))
        : [record, ...list];
      return { ...current, [key]: nextList } as AppData;
    });
  }

  const goalById = (id: string | null | undefined) => data.goals.find((goal) => goal.id === id);
  const dreamById = (id: string | null | undefined) => data.dreams.find((dream) => dream.id === id);

  const activeTasks = useMemo(
    () => data.tasks.filter((task) => task.status !== "done" && task.status !== "archived"),
    [data.tasks]
  );

  const todayCompletionRecords = useMemo(
    () => data.taskCompletionRecords.filter((record) => record.completion_date === journalDate).sort((a, b) => b.completed_at.localeCompare(a.completed_at)),
    [data.taskCompletionRecords, journalDate]
  );

  const recentlyActedDreamIds = useMemo(() => {
    const goalMap = new Map(data.goals.map((goal) => [goal.id, goal]));
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    return new Set(
      [
        ...data.tasks
          .filter((task) => task.status === "done" && task.completed_at && new Date(task.completed_at).getTime() >= sevenDaysAgo)
          .map((task) => task.dream_id ?? goalMap.get(task.goal_id ?? "")?.dream_id),
        ...data.taskCompletionRecords
          .filter((record) => new Date(record.completed_at).getTime() >= sevenDaysAgo)
          .map((record) => record.dream_id ?? goalMap.get(record.goal_id ?? "")?.dream_id)
      ]
        .filter(Boolean) as string[]
    );
  }, [data.tasks, data.taskCompletionRecords, data.goals]);

  const todayTasks = useMemo(() => {
    const goalMap = new Map(data.goals.map((goal) => [goal.id, goal]));
    const dreamIdFor = (task: Task) => task.dream_id ?? goalMap.get(task.goal_id ?? "")?.dream_id ?? null;
    const score = (task: Task) => {
      const distance = dateDistanceFrom(task.due_date, journalDate);
      const linkedDreamId = dreamIdFor(task);
      return (
        (task.urgent && task.important ? 120 : 0) +
        (task.important ? 55 : 0) +
        (!task.urgent && task.important ? 35 : 0) +
        (task.urgent ? 30 : 0) +
        (distance < 0 ? 80 : distance === 0 ? 55 : distance <= 3 ? 30 - distance * 5 : 0) +
        (linkedDreamId ? 18 : 0) +
        (linkedDreamId && !recentlyActedDreamIds.has(linkedDreamId) ? 25 : 0)
      );
    };
    return [...activeTasks]
      .filter((task) => {
        if (isRecurringTask(task)) return isRecurringTaskDueOn(task, journalDate) && !isTaskCompletedOn(task.id, journalDate, data.taskCompletionRecords);
        const distance = dateDistanceFrom(task.due_date, journalDate);
        const linkedDreamId = dreamIdFor(task);
        return task.urgent || task.important || distance <= 3 || Boolean(linkedDreamId && !recentlyActedDreamIds.has(linkedDreamId));
      })
      .sort((a, b) => score(b) - score(a));
  }, [activeTasks, data.goals, data.taskCompletionRecords, recentlyActedDreamIds, journalDate]);

  const rolloverIncompleteTasks = useMemo(
    () => todayTasks.filter((task) => task.status !== "done" && task.status !== "archived" && !isRecurringTask(task)),
    [todayTasks]
  );

  const todayAiInput = useMemo<TodayAiSuggestionInput>(() => {
    const goalMap = new Map(data.goals.map((goal) => [goal.id, goal]));
    const dreamMap = new Map(data.dreams.map((dream) => [dream.id, dream]));
    const taskDreamId = (task: Task) => task.dream_id ?? goalMap.get(task.goal_id ?? "")?.dream_id ?? null;
    const mostRecentReflection = [...data.reflections].sort((a, b) => b.reflection_date.localeCompare(a.reflection_date))[0];

    return {
      date: journalDate,
      tasks: todayTasks.slice(0, 12).map((task) => {
        const goal = goalMap.get(task.goal_id ?? "");
        const dreamId = taskDreamId(task);
        const dream = dreamId ? dreamMap.get(dreamId) : undefined;
        return {
          id: task.id,
          title: task.title,
          memo: task.memo?.slice(0, 240) ?? "",
          due_date: task.due_date,
          urgent: task.urgent,
          important: task.important,
          dream_title: dream?.title ?? null,
          goal_title: goal?.title ?? null,
          matrix_label: matrixLabel(task),
          days_until_due: task.due_date ? dateDistanceFrom(task.due_date, journalDate) : null,
          dream_recently_acted: Boolean(dreamId && recentlyActedDreamIds.has(dreamId))
        };
      }),
      active_dreams: data.dreams
        .filter((dream) => dream.status === "active")
        .slice(0, 8)
        .map((dream) => ({
          id: dream.id,
          title: dream.title,
          deadline: dream.deadline,
          desired_state: dream.desired_state,
          recently_acted: recentlyActedDreamIds.has(dream.id)
        })),
      recent_reflection: mostRecentReflection
        ? {
            done_text: mostRecentReflection.done_text?.slice(0, 180),
            not_done_text: mostRecentReflection.not_done_text?.slice(0, 180),
            dream_progress_text: mostRecentReflection.dream_progress_text?.slice(0, 180),
            tomorrow_text: mostRecentReflection.tomorrow_text?.slice(0, 180)
          }
        : null
    };
  }, [data.dreams, data.goals, data.reflections, recentlyActedDreamIds, todayTasks, journalDate]);

  const todayAiContextHash = useMemo(() => simpleHash(JSON.stringify(todayAiInput)), [todayAiInput]);
  const todayAiSuggestion = useMemo(
    () =>
      data.todayAiSuggestions
        .filter(
          (suggestion) =>
            suggestion.status === "active" &&
            suggestion.suggestion_date === journalDate &&
            suggestion.context_hash === todayAiContextHash
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0],
    [data.todayAiSuggestions, todayAiContextHash, journalDate]
  );

  const homeMonthlyGoals = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.level === "monthly")
        .sort((a, b) => dateDistance(a.deadline) - dateDistance(b.deadline))
        .slice(0, 3),
    [activeGoals]
  );

  const homeTwentyYearGoals = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.level === "twenty_year")
        .sort((a, b) => dateDistance(a.deadline) - dateDistance(b.deadline))
        .slice(0, 3),
    [activeGoals]
  );

  const homeTenYearGoals = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.level === "ten_year")
        .sort((a, b) => dateDistance(a.deadline) - dateDistance(b.deadline))
        .slice(0, 3),
    [activeGoals]
  );

  const homeWeeklyGoals = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.level === "weekly")
        .sort((a, b) => dateDistance(a.deadline) - dateDistance(b.deadline))
        .slice(0, 3),
    [activeGoals]
  );

  const homeYearGoals = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.level === "one_year")
        .sort((a, b) => dateDistance(a.deadline) - dateDistance(b.deadline))
        .slice(0, 3),
    [activeGoals]
  );

  const homeFiveYearGoals = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.level === "five_year" || goal.level === "three_year")
        .sort((a, b) => dateDistance(a.deadline) - dateDistance(b.deadline))
        .slice(0, 4),
    [activeGoals]
  );

  const visibleMotivationCards = useMemo(
    () => data.motivationCards.filter((card) => card.visible).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)),
    [data.motivationCards]
  );
  const motivationCardIndex = useMemo(() => {
    if (visibleMotivationCards.length === 0 || typeof window === "undefined") return 0;
    const key = "ai-dream-note-motivation-card";
    try {
      const saved = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { date?: string; index?: number };
      if (saved.date === journalDate && typeof saved.index === "number") return saved.index % visibleMotivationCards.length;
      const nextIndex = ((saved.index ?? -1) + 1) % visibleMotivationCards.length;
      window.localStorage.setItem(key, JSON.stringify({ date: journalDate, index: nextIndex }));
      return nextIndex;
    } catch {
      return 0;
    }
  }, [visibleMotivationCards, journalDate]);

  const currentWeek = useMemo(() => weekBounds(journalDate), [journalDate]);
  const weeklyReviewInput = useMemo<WeeklyReviewInput>(() => {
    const goalMap = new Map(data.goals.map((goal) => [goal.id, goal]));
    const dreamMap = new Map(data.dreams.map((dream) => [dream.id, dream]));
    const taskMap = new Map(data.tasks.map((task) => [task.id, task]));
    const taskDreamId = (task: Task) => task.dream_id ?? goalMap.get(task.goal_id ?? "")?.dream_id ?? null;
    const inWeek = (date: string | null | undefined) => Boolean(date && date.slice(0, 10) >= currentWeek.weekStart && date.slice(0, 10) <= currentWeek.weekEnd);
    const completedTasks = [
      ...data.tasks.filter((task) => task.status === "done" && inWeek(task.completed_at)),
      ...data.taskCompletionRecords
        .filter((record) => inWeek(record.completed_at) && taskMap.get(record.task_id)?.status !== "done")
        .map((record) => {
          const original = taskMap.get(record.task_id);
          return {
            ...(original ??
              ({
                id: record.task_id,
                user_id: record.user_id,
                dream_id: record.dream_id,
                goal_id: record.goal_id,
                title: record.title_snapshot,
                memo: "",
                due_date: record.completion_date,
                urgent: record.urgent,
                important: record.important,
                status: "todo",
                completed_at: record.completed_at,
                created_at: record.created_at,
                updated_at: record.updated_at
              } as Task)),
            completed_at: record.completed_at
          } as Task;
        })
    ];
    const completedByDream = new Map<string, { total: number; important: number }>();
    for (const task of completedTasks) {
      const dreamId = taskDreamId(task);
      if (!dreamId) continue;
      const current = completedByDream.get(dreamId) ?? { total: 0, important: 0 };
      completedByDream.set(dreamId, { total: current.total + 1, important: current.important + (task.important ? 1 : 0) });
    }

    return {
      week_start: currentWeek.weekStart,
      week_end: currentWeek.weekEnd,
      completed_tasks: completedTasks.slice(0, 40).map((task) => {
        const goal = goalMap.get(task.goal_id ?? "");
        const dreamId = taskDreamId(task);
        const dream = dreamId ? dreamMap.get(dreamId) : undefined;
        return {
          id: task.id,
          title: task.title,
          completed_at: task.completed_at ?? "",
          urgent: task.urgent,
          important: task.important,
          matrix_label: matrixLabel(task),
          dream_title: dream?.title ?? null,
          goal_title: goal?.title ?? null
        };
      }),
      active_dreams: data.dreams
        .filter((dream) => dream.status === "active")
        .slice(0, 12)
        .map((dream) => ({
          id: dream.id,
          title: dream.title,
          category: dream.category,
          deadline: dream.deadline,
          desired_state: dream.desired_state,
          completed_task_count: completedByDream.get(dream.id)?.total ?? 0,
          important_completed_count: completedByDream.get(dream.id)?.important ?? 0
        })),
      reflections: data.reflections
        .filter((reflection) => reflection.reflection_date >= currentWeek.weekStart && reflection.reflection_date <= currentWeek.weekEnd)
        .sort((a, b) => a.reflection_date.localeCompare(b.reflection_date))
        .map((reflection) => ({
          date: reflection.reflection_date,
          done_text: reflection.done_text?.slice(0, 180),
          not_done_text: reflection.not_done_text?.slice(0, 180),
          dream_progress_text: reflection.dream_progress_text?.slice(0, 180),
          tomorrow_text: reflection.tomorrow_text?.slice(0, 180),
          insight_text: reflection.insight_text?.slice(0, 180),
          satisfaction_score: reflection.satisfaction_score
        })),
      stats: {
        completed_total: completedTasks.length,
        urgent_completed: completedTasks.filter((task) => task.urgent).length,
        important_completed: completedTasks.filter((task) => task.important).length,
        second_quadrant_completed: completedTasks.filter((task) => !task.urgent && task.important).length,
        unlinked_completed: completedTasks.filter((task) => !taskDreamId(task)).length
      }
    };
  }, [currentWeek.weekEnd, currentWeek.weekStart, data.dreams, data.goals, data.reflections, data.taskCompletionRecords, data.tasks]);

  const weeklyReviewContextHash = useMemo(() => simpleHash(JSON.stringify(weeklyReviewInput)), [weeklyReviewInput]);
  const weeklyAiReview = useMemo(
    () =>
      data.weeklyAiReviews
        .filter(
          (review) =>
            review.status === "active" &&
            review.week_start === currentWeek.weekStart &&
            review.context_hash === weeklyReviewContextHash
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0],
    [currentWeek.weekStart, data.weeklyAiReviews, weeklyReviewContextHash]
  );

  const todayReflection = data.reflections.find((reflection) => reflection.reflection_date === today());
  const selectedSuggestion = data.aiSuggestions.find((suggestion) => suggestion.id === selectedSuggestionId);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: { emailRedirectTo: window.location.origin }
    });
    setAuthMessage(error ? error.message : "ログイン用リンクをメールに送信しました。");
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }

  async function saveDream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = editingDream;
    const deadline = normalizeDate(form.get("deadline"));
    if (deadline === "invalid") {
      setNotice({ type: "error", message: "期限は YYYY-MM-DD 形式で入力してください。" });
      return;
    }
    const dream: Dream = {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: userId,
      title: String(form.get("title") ?? ""),
      reason: String(form.get("reason") ?? ""),
      deadline,
      category: String(form.get("category") ?? dreamPillars[0]),
      desired_state: String(form.get("desired_state") ?? ""),
      status: existing?.status ?? "active",
      priority: existing?.priority ?? data.dreams.length + 1,
      created_at: existing?.created_at ?? now(),
      updated_at: now()
    };
    const saved = await persist("dreams", dream);
    if (!saved) return;
    upsertLocal("dreams", dream);
    setEditingDreamId(null);
    if (!existing) setDreamFormVersion((version) => version + 1);
    setNotice({ type: "success", message: "保存しました" });
    setTab("dreams");
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = editingGoal;
    const deadline = normalizeDate(form.get("deadline"));
    if (deadline === "invalid") {
      setNotice({ type: "error", message: "期限は YYYY-MM-DD 形式で入力してください。" });
      return;
    }
    const parentId = normalizeId(form.get("parent_goal_id"));
    if (existing && parentId && goalDescendantIds(existing.id, data.goals).has(parentId)) {
      setNotice({ type: "error", message: "下位の項目を上位項目にはできません。親子関係を確認してください。" });
      return;
    }
    const goal: Goal = {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: userId,
      dream_id: normalizeId(form.get("dream_id")),
      parent_goal_id: parentId,
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      level: String(form.get("level") ?? "monthly") as Goal["level"],
      category: String(form.get("category") ?? existing?.category ?? dreamPillars[0]),
      deadline,
      status: existing?.status ?? "todo",
      created_at: existing?.created_at ?? now(),
      updated_at: now()
    };
    const childTitles = parseLineItems(form.getAll("child_items"));
    const nextStep = nextPlanStep(goal.level);
    const childGoals: Goal[] =
      nextStep && nextStep !== "task"
        ? childTitles.map((title) => ({
            id: crypto.randomUUID(),
            user_id: userId,
            dream_id: goal.dream_id,
            parent_goal_id: goal.id,
            title,
            description: "",
            level: nextStep,
            category: goal.category,
            deadline: goal.deadline,
            status: "todo",
            created_at: now(),
            updated_at: now()
          }))
        : [];
    const childTasks: Task[] =
      nextStep === "task"
        ? childTitles.map((title) => ({
            id: crypto.randomUUID(),
            user_id: userId,
            dream_id: goal.dream_id,
            goal_id: goal.id,
            title,
            memo: "",
            due_date: today(),
            urgent: false,
            important: true,
            status: "todo",
            completed_at: null,
            reschedule_count: 0,
            last_rescheduled_at: null,
            rescheduled_from: null,
            rescheduled_to: null,
            reschedule_history: [],
            recurrence_type: "none",
            recurrence_weekdays: [],
            recurrence_day_of_month: null,
            recurrence_start_date: null,
            recurrence_active: false,
            created_at: now(),
            updated_at: now()
          }))
        : [];
    const saved = await persist("goals", goal);
    if (!saved) return;
    for (const childGoal of childGoals) {
      const childSaved = await persist("goals", childGoal);
      if (!childSaved) {
        setNotice({ type: "error", message: "目標は保存しましたが、達成するためのタスクの保存に失敗しました。入力内容を確認してください。" });
        return;
      }
    }
    for (const childTask of childTasks) {
      const childSaved = await persist("tasks", childTask);
      if (!childSaved) {
        setNotice({ type: "error", message: "目標は保存しましたが、今日やることの保存に失敗しました。入力内容を確認してください。" });
        return;
      }
    }
    upsertLocal("goals", goal);
    childGoals.forEach((childGoal) => upsertLocal("goals", childGoal));
    childTasks.forEach((childTask) => upsertLocal("tasks", childTask));
    setEditingGoalId(null);
    if (!existing) {
      setGoalDraft(null);
      setGoalFormVersion((version) => version + 1);
    }
    setSelectedGoalLevel(goal.level);
    setNotice({ type: "success", message: "保存しました" });
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = editingTask;
    const selectedGoalId = normalizeId(form.get("goal_id"));
    const selectedGoal = activeGoals.find((goal) => goal.id === selectedGoalId);
    const selectedDreamId = normalizeId(form.get("dream_id"));
    const coherentGoalId = selectedGoal && (!selectedDreamId || !selectedGoal.dream_id || selectedGoal.dream_id === selectedDreamId) ? selectedGoal.id : null;
    const coherentDreamId = selectedGoal?.dream_id ?? selectedDreamId;
    const dueDate = normalizeDate(form.get("due_date"));
    if (dueDate === "invalid") {
      setNotice({ type: "error", message: "期限は YYYY-MM-DD 形式で入力してください。" });
      return;
    }
    const recurrenceType = String(form.get("recurrence_type") ?? existing?.recurrence_type ?? "none") as RecurrenceType;
    const recurrenceStartDate = normalizeDate(form.get("recurrence_start_date")) || dueDate;
    if (recurrenceStartDate === "invalid") {
      setNotice({ type: "error", message: "繰り返し開始日は YYYY-MM-DD 形式で入力してください。" });
      return;
    }
    const recurrenceWeekdays = form
      .getAll("recurrence_weekdays")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value));
    const recurrenceDayOfMonthValue = Number(form.get("recurrence_day_of_month") ?? "");
    const recurrenceDayOfMonth = recurrenceDayOfMonthValue >= 1 && recurrenceDayOfMonthValue <= 31 ? recurrenceDayOfMonthValue : null;
    const task: Task = {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: userId,
      dream_id: coherentDreamId,
      goal_id: coherentGoalId,
      title: String(form.get("title") ?? ""),
      memo: String(form.get("memo") ?? ""),
      due_date: dueDate,
      urgent: form.get("urgent") === "on",
      important: form.get("important") === "on",
      status: existing?.status ?? "todo",
      completed_at: existing?.completed_at ?? null,
      reschedule_count: existing?.reschedule_count ?? 0,
      last_rescheduled_at: existing?.last_rescheduled_at ?? null,
      rescheduled_from: existing?.rescheduled_from ?? null,
      rescheduled_to: existing?.rescheduled_to ?? null,
      reschedule_history: existing?.reschedule_history ?? [],
      recurrence_type: recurrenceType,
      recurrence_weekdays: recurrenceType === "weekdays" ? recurrenceWeekdays : [],
      recurrence_day_of_month: recurrenceType === "monthly" ? recurrenceDayOfMonth : null,
      recurrence_start_date: recurrenceType === "none" ? null : recurrenceStartDate,
      recurrence_active: recurrenceType !== "none",
      created_at: existing?.created_at ?? now(),
      updated_at: now()
    };
    const saved = await persist("tasks", task);
    if (!saved) return;
    upsertLocal("tasks", task);
    setEditingTaskId(null);
    if (!existing) {
      setTaskDraft(null);
      setTaskFormVersion((version) => version + 1);
    }
    setNotice({ type: "success", message: "保存しました" });
    setTab("tasks");
  }

  async function saveInboxItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = editingInboxItem;
    const item: InboxItem = {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: userId,
      title: String(form.get("title") ?? ""),
      memo: String(form.get("memo") ?? ""),
      kind: String(form.get("kind") ?? "idea") as InboxItem["kind"],
      status: existing?.status ?? "open",
      created_at: existing?.created_at ?? now(),
      updated_at: now()
    };
    const saved = await persist("inbox_items", item);
    if (!saved) return;
    upsertLocal("inbox", item);
    setEditingInboxId(null);
    if (!existing) setInboxFormVersion((version) => version + 1);
    setNotice({ type: "success", message: "保存しました" });
  }

  function startDecomposeGoal(goal: Goal) {
    const nextStep = nextPlanStep(goal.level);
    if (!nextStep) {
      setNotice({ type: "error", message: "この目標から分解できる次の階層がありません。" });
      return;
    }

    setEditingGoalId(null);
    setEditingTaskId(null);

    if (nextStep === "task") {
      setTaskDraft({
        dream_id: goal.dream_id,
        goal_id: goal.id,
        due_date: today(),
        urgent: false,
        important: true,
        status: "todo",
        title: "",
        memo: ""
      });
      setTaskFormVersion((version) => version + 1);
      setTab("tasks");
      setNotice({ type: "success", message: "今週の目標から、今日の行動へ分解します。" });
      return;
    }

    setGoalDraft({
      dream_id: goal.dream_id,
      parent_goal_id: goal.id,
      level: nextStep,
      category: goal.category,
      deadline: goal.deadline,
      status: "todo",
      title: "",
      description: ""
    });
    setSelectedGoalLevel(nextStep);
    setGoalFormVersion((version) => version + 1);
    setTab("goals");
    setNotice({ type: "success", message: `${goalLabels[goal.level]}から${goalLabels[nextStep]}へ分解します。` });
  }

  async function clarifyDreamWithAi(dream: Dream) {
    setAiLoadingDreamId(dream.id);
    setNotice(null);
    try {
      const response = await fetch("/api/ai/dream-clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dream: {
            title: dream.title,
            reason: dream.reason,
            deadline: dream.deadline,
            category: dream.category,
            desired_state: dream.desired_state
          }
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.suggestion) {
        throw new Error(payload.error || "AI提案を取得できませんでした。");
      }
      const record: AiSuggestionRecord = {
        id: crypto.randomUUID(),
        user_id: userId,
        dream_id: dream.id,
        input_snapshot: {
          title: dream.title,
          reason: dream.reason,
          deadline: dream.deadline,
          category: dream.category,
          desired_state: dream.desired_state
        },
        output_json: payload.suggestion as AiDreamSuggestionOutput,
        status: "pending",
        created_at: now(),
        updated_at: now()
      };
      upsertLocal("aiSuggestions", record);
      await persist("ai_suggestions", record);
      setSelectedSuggestionId(record.id);
      setNotice({ type: "success", message: "AI提案を作成しました。採用するまで目標・タスクには登録されません。" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "AI提案を取得できませんでした。" });
    } finally {
      setAiLoadingDreamId(null);
    }
  }

  async function generateTodayActionsWithAi() {
    if (todayAiInput.tasks.length === 0) {
      setNotice({ type: "error", message: "AIに渡せる今日の候補タスクがありません。まず重要タスクや期限つきタスクを追加してください。" });
      return;
    }
    if (todayAiSuggestion) {
      setNotice({ type: "success", message: "今日のAI提案は最新です。同じ状況なので再生成せず表示しています。" });
      return;
    }

    setAiTodayLoading(true);
    setNotice(null);
    try {
      const response = await fetch("/api/ai/today-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: todayAiInput })
      });
      const payload = await response.json();
      if (!response.ok || !payload.suggestion) {
        throw new Error(payload.error || "今日やることAIを取得できませんでした。");
      }
      const record: TodayAiSuggestionRecord = {
        id: crypto.randomUUID(),
        user_id: userId,
        suggestion_date: today(),
        context_hash: todayAiContextHash,
        input_snapshot: todayAiInput,
        output_json: payload.suggestion as TodayAiSuggestionOutput,
        status: "active",
        created_at: now(),
        updated_at: now()
      };
      upsertLocal("todayAiSuggestions", record);
      await persist("today_ai_suggestions", record);
      setNotice({ type: "success", message: "今日やることAIを作成しました。既存タスクは変更していません。" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "今日やることAIを取得できませんでした。" });
    } finally {
      setAiTodayLoading(false);
    }
  }

  async function generateWeeklyReviewWithAi() {
    if (weeklyReviewInput.completed_tasks.length === 0 && weeklyReviewInput.reflections.length === 0) {
      setNotice({ type: "error", message: "週次レビューに使える今週の完了タスクまたは振り返りがまだありません。" });
      return;
    }
    if (weeklyAiReview) {
      setNotice({ type: "success", message: "今週のAIレビューは最新です。同じ状況なので再生成せず表示しています。" });
      return;
    }

    setAiWeeklyLoading(true);
    setNotice(null);
    try {
      const response = await fetch("/api/ai/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: weeklyReviewInput })
      });
      const payload = await response.json();
      if (!response.ok || !payload.review) {
        throw new Error(payload.error || "週次レビューAIを取得できませんでした。");
      }
      const record: WeeklyAiReviewRecord = {
        id: crypto.randomUUID(),
        user_id: userId,
        week_start: currentWeek.weekStart,
        week_end: currentWeek.weekEnd,
        context_hash: weeklyReviewContextHash,
        input_snapshot: weeklyReviewInput,
        output_json: payload.review as WeeklyReviewOutput,
        status: "active",
        created_at: now(),
        updated_at: now()
      };
      upsertLocal("weeklyAiReviews", record);
      await persist("weekly_ai_reviews", record);
      setNotice({ type: "success", message: "週次レビューAIを作成しました。既存データは変更していません。" });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "週次レビューAIを取得できませんでした。" });
    } finally {
      setAiWeeklyLoading(false);
    }
  }

  async function updateSuggestionStatus(suggestion: AiSuggestionRecord, status: AiSuggestionRecord["status"]) {
    const updated: AiSuggestionRecord = { ...suggestion, status, updated_at: now() };
    upsertLocal("aiSuggestions", updated);
    await persist("ai_suggestions", updated);
  }

  async function adoptClarifiedDream(suggestion: AiSuggestionRecord, clarified = suggestion.output_json.clarified_dream) {
    const dream = dreamById(suggestion.dream_id);
    if (!dream) return;
    const updated: Dream = {
      ...dream,
      title: clarified.title,
      reason: clarified.description,
      desired_state: clarified.success_definition,
      updated_at: now()
    };
    upsertLocal("dreams", updated);
    await persist("dreams", updated);
    await updateSuggestionStatus(suggestion, suggestion.status === "accepted" ? "accepted" : "partially_accepted");
  }

  async function adoptMilestone(
    suggestion: AiSuggestionRecord,
    milestone: AiDreamSuggestionOutput["milestones"][number]
  ) {
    const goal: Goal = {
      id: crypto.randomUUID(),
      user_id: userId,
      dream_id: suggestion.dream_id,
      parent_goal_id: null,
      title: milestone.title,
      description: `${milestone.description}\n目安: ${milestone.target_period}`,
      level: milestone.suggested_goal_level,
      deadline: null,
      status: "todo",
      created_at: now(),
      updated_at: now()
    };
    upsertLocal("goals", goal);
    await persist("goals", goal);
    await updateSuggestionStatus(suggestion, "partially_accepted");
  }

  async function adoptFirstAction(
    suggestion: AiSuggestionRecord,
    action: AiDreamSuggestionOutput["first_actions"][number]
  ) {
    const task: Task = {
      id: crypto.randomUUID(),
      user_id: userId,
      dream_id: suggestion.dream_id,
      goal_id: null,
      title: action.title,
      memo: `${action.reason}\n完了条件: ${action.completion_condition || "この行動を1回完了する"}\n目安: ${action.estimated_minutes}分`,
      due_date: today(),
      urgent: false,
      important: true,
      status: "todo",
      completed_at: null,
      reschedule_count: 0,
      reschedule_history: [],
      created_at: now(),
      updated_at: now()
    };
    upsertLocal("tasks", task);
    await persist("tasks", task);
    await updateSuggestionStatus(suggestion, "partially_accepted");
  }

  async function adoptAllAiSuggestion(
    suggestion: AiSuggestionRecord,
    drafts: AiDreamSuggestionOutput
  ) {
    if (suggestion.status === "accepted") {
      setNotice({ type: "success", message: "このAI提案はすでに採用済みです。" });
      setSelectedSuggestionId(null);
      return;
    }
    const dream = dreamById(suggestion.dream_id);
    if (dream) {
      const updated: Dream = {
        ...dream,
        title: drafts.clarified_dream.title,
        reason: drafts.clarified_dream.description,
        desired_state: drafts.clarified_dream.success_definition,
        updated_at: now()
      };
      upsertLocal("dreams", updated);
      await persist("dreams", updated);
    }
    for (const milestone of drafts.milestones) {
      const goal: Goal = {
        id: crypto.randomUUID(),
        user_id: userId,
        dream_id: suggestion.dream_id,
        parent_goal_id: null,
        title: milestone.title,
        description: `${milestone.description}\n目安: ${milestone.target_period}`,
        level: milestone.suggested_goal_level,
        deadline: null,
        status: "todo",
        created_at: now(),
        updated_at: now()
      };
      upsertLocal("goals", goal);
      await persist("goals", goal);
    }
    for (const action of drafts.first_actions) {
      const task: Task = {
        id: crypto.randomUUID(),
        user_id: userId,
        dream_id: suggestion.dream_id,
        goal_id: null,
        title: action.title,
        memo: `${action.reason}\n完了条件: ${action.completion_condition || "この行動を1回完了する"}\n目安: ${action.estimated_minutes}分`,
        due_date: today(),
        urgent: false,
        important: true,
        status: "todo",
        completed_at: null,
        reschedule_count: 0,
        reschedule_history: [],
        created_at: now(),
        updated_at: now()
      };
      upsertLocal("tasks", task);
      await persist("tasks", task);
    }
    await updateSuggestionStatus(suggestion, "accepted");
    setNotice({ type: "success", message: "AI提案を採用しました。目標と最初の行動に登録しました。" });
    setSelectedSuggestionId(null);
  }

  async function completeTask(task: Task) {
    const completedAt = now();
    const completionDate = today();
    const record: TaskCompletionRecord = {
      id: completionRecordId(task.id, completionDate),
      user_id: userId,
      task_id: task.id,
      completion_date: completionDate,
      completed_at: completedAt,
      title_snapshot: task.title,
      dream_id: task.dream_id,
      goal_id: task.goal_id,
      urgent: task.urgent,
      important: task.important,
      created_at: completedAt,
      updated_at: completedAt
    };
    const updated: Task = isRecurringTask(task)
      ? { ...task, completed_at: completedAt, updated_at: completedAt }
      : { ...task, status: "done", completed_at: completedAt, updated_at: completedAt };

    const recordSaved = await persist("task_completion_records", record);
    if (!recordSaved) return;
    const taskSaved = await persist("tasks", updated);
    if (!taskSaved) return;
    const nextRecords = [record, ...data.taskCompletionRecords.filter((item) => item.id !== record.id)];
    const nextTasks = data.tasks.map((item) => (item.id === updated.id ? updated : item));
    const nextGoals = reconcileGoalStatuses(data.goals, nextTasks, nextRecords, task.goal_id);
    const goalsToPersist = changedGoals(data.goals, nextGoals);
    for (const goal of goalsToPersist) {
      await persist("goals", goal);
    }
    setData((current) => ({
      ...current,
      taskCompletionRecords: [record, ...current.taskCompletionRecords.filter((item) => item.id !== record.id)],
      tasks: current.tasks.map((item) => (item.id === updated.id ? updated : item)),
      goals: nextGoals
    }));
    setNotice({
      type: "success",
      message: "完了しました。",
      actionLabel: "元に戻す",
      onAction: () => void undoTaskCompletion(record)
    });
  }

  async function undoTaskCompletion(record: TaskCompletionRecord) {
    const task = data.tasks.find((item) => item.id === record.task_id);
    const nextRecords = data.taskCompletionRecords.filter((item) => item.id !== record.id);
    const latestRemainingRecord = nextRecords
      .filter((item) => item.task_id === record.task_id)
      .sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];
    const updatedTask = task
      ? {
          ...task,
          status: isRecurringTask(task) ? task.status : "todo",
          completed_at: latestRemainingRecord?.completed_at ?? null,
          updated_at: now()
        }
      : null;
    const nextTasks = updatedTask ? data.tasks.map((item) => (item.id === updatedTask.id ? updatedTask : item)) : data.tasks;
    const nextGoals = reconcileGoalStatuses(data.goals, nextTasks, nextRecords, record.goal_id ?? task?.goal_id);
    const goalsToPersist = changedGoals(data.goals, nextGoals);

    const recordDeleted = await deleteRemote("task_completion_records", record.id);
    if (!recordDeleted) return;
    if (updatedTask) {
      const taskSaved = await persist("tasks", updatedTask);
      if (!taskSaved) return;
    }
    for (const goal of goalsToPersist) {
      await persist("goals", goal);
    }

    setData((current) => ({
      ...current,
      taskCompletionRecords: current.taskCompletionRecords.filter((item) => item.id !== record.id),
      tasks: updatedTask ? current.tasks.map((item) => (item.id === updatedTask.id ? updatedTask : item)) : current.tasks,
      goals: nextGoals
    }));
    setNotice({ type: "success", message: "完了を取り消しました。今日やることへ戻しました。" });
  }

  async function updateCompletionTime(record: TaskCompletionRecord, timeValue: string) {
    if (!/^\d{2}:\d{2}$/.test(timeValue)) {
      setNotice({ type: "error", message: "時刻は HH:MM 形式で入力してください。" });
      return;
    }
    const updated: TaskCompletionRecord = {
      ...record,
      completed_at: new Date(`${record.completion_date}T${timeValue}:00`).toISOString(),
      updated_at: now()
    };
    const saved = await persist("task_completion_records", updated);
    if (!saved) return;
    upsertLocal("taskCompletionRecords", updated);
    setNotice({ type: "success", message: "完了時刻を訂正しました。" });
  }

  async function updateDreamStatus(dream: Dream, status: Dream["status"]) {
    const updated: Dream = { ...dream, status, updated_at: now() };
    upsertLocal("dreams", updated);
    await persist("dreams", updated);
  }

  async function deleteDream(dream: Dream) {
    const relatedGoalCount = data.goals.filter((goal) => goal.dream_id === dream.id).length;
    const relatedTaskCount = data.tasks.filter((task) => task.dream_id === dream.id).length;
    const ok = window.confirm(
      `「${dream.title}」を削除しますか？\n関連する目標${relatedGoalCount}件・タスク${relatedTaskCount}件は削除せず、夢との紐付けだけ外します。`
    );
    if (!ok) return;

    const deleted = await deleteRemote("dreams", dream.id);
    if (!deleted) return;
    setData((current) => ({
      ...current,
      dreams: current.dreams.filter((item) => item.id !== dream.id),
      goals: current.goals.map((goal) => (goal.dream_id === dream.id ? { ...goal, dream_id: null, updated_at: now() } : goal)),
      tasks: current.tasks.map((task) => (task.dream_id === dream.id ? { ...task, dream_id: null, updated_at: now() } : task)),
      aiSuggestions: current.aiSuggestions.map((suggestion) =>
        suggestion.dream_id === dream.id ? { ...suggestion, dream_id: null, updated_at: now() } : suggestion
      )
    }));
    if (editingDreamId === dream.id) setEditingDreamId(null);
    setNotice({ type: "success", message: "夢を削除しました。関連する目標・タスクは残しています。" });
  }

  async function archiveGoal(goal: Goal) {
    const updated: Goal = { ...goal, status: "archived", updated_at: now() };
    upsertLocal("goals", updated);
    await persist("goals", updated);
  }

  async function deleteGoal(goal: Goal) {
    const relatedTaskCount = data.tasks.filter((task) => task.goal_id === goal.id).length;
    const childGoalCount = data.goals.filter((item) => item.parent_goal_id === goal.id).length;
    const ok = window.confirm(
      `「${goal.title}」を削除しますか？\n関連するタスク${relatedTaskCount}件・下位目標${childGoalCount}件は削除せず、目標との紐付けだけ外します。`
    );
    if (!ok) return;

    const deleted = await deleteRemote("goals", goal.id);
    if (!deleted) return;
    setData((current) => ({
      ...current,
      goals: current.goals
        .filter((item) => item.id !== goal.id)
        .map((item) => (item.parent_goal_id === goal.id ? { ...item, parent_goal_id: null, updated_at: now() } : item)),
      tasks: current.tasks.map((task) => (task.goal_id === goal.id ? { ...task, goal_id: null, updated_at: now() } : task))
    }));
    if (editingGoalId === goal.id) setEditingGoalId(null);
    setNotice({ type: "success", message: "目標を削除しました。関連するタスクは残しています。" });
  }

  async function archiveTask(task: Task) {
    const updated: Task = { ...task, status: "archived", updated_at: now() };
    upsertLocal("tasks", updated);
    await persist("tasks", updated);
  }

  async function rescheduleTask(task: Task, destination: RescheduleDestination, customDate?: string) {
    if (task.status === "done" || task.status === "archived") {
      setNotice({ type: "error", message: "完了・アーカイブ済みタスクは転記できません。" });
      return;
    }

    let nextDueDate: DateValue = null;
    let nextStatus: Task["status"] = "todo";
    if (destination === "tomorrow") nextDueDate = addDays(today(), 1);
    if (destination === "this_week") nextDueDate = futureOrTomorrow(weekBounds().weekEnd);
    if (destination === "next_week") nextDueDate = nextWeekStart();
    if (destination === "this_month") nextDueDate = futureOrTomorrow(monthEnd());
    if (destination === "custom") {
      const normalized = normalizeDate(customDate ?? null);
      if (normalized === "invalid") {
        setNotice({ type: "error", message: "転記先の日付は YYYY-MM-DD 形式で入力してください。" });
        return;
      }
      if (!normalized) {
        setNotice({ type: "error", message: "転記先の日付を入力してください。" });
        return;
      }
      nextDueDate = normalized;
    }
    if (destination === "hold" || destination === "drop") {
      nextDueDate = null;
      nextStatus = "archived";
    }

    const historyItem: RescheduleHistoryItem = {
      rescheduled_at: now(),
      from_due_date: task.due_date,
      to_due_date: nextDueDate,
      destination
    };
    const updated: Task = {
      ...task,
      due_date: nextDueDate,
      status: nextStatus,
      reschedule_count: taskRescheduleCount(task) + 1,
      last_rescheduled_at: historyItem.rescheduled_at,
      rescheduled_from: task.due_date,
      rescheduled_to: nextDueDate,
      reschedule_history: [...(task.reschedule_history ?? []), historyItem],
      updated_at: now()
    };
    if (!cloudMode && typeof window !== "undefined") {
      const nextData: AppData = {
        ...data,
        tasks: data.tasks.map((item) => (item.id === updated.id ? updated : item))
      };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(nextData));
      } catch {
        setNotice({ type: "error", message: "ローカル保存に失敗しました。転記は反映していません。" });
        return;
      }
      setData(nextData);
      setReschedulingTaskId(null);
      setNotice({ type: "success", message: destination === "drop" ? "もうやらないにしました。" : "転記しました。" });
      return;
    }
    const saved = await persist("tasks", updated);
    if (!saved) return;
    upsertLocal("tasks", updated);
    setReschedulingTaskId(null);
    setNotice({ type: "success", message: destination === "drop" ? "もうやらないにしました。" : "転記しました。" });
  }

  async function switchToNextJournalDay(mode: RolloverMode, individualSelections: Record<string, RolloverMode> = {}) {
    const currentDate = today();
    const nextDate = addDays(currentDate, 1);
    const previousData = data;
    const tasksToUpdate = rolloverIncompleteTasks
      .map((task) => {
        const taskMode = mode === "individual" ? individualSelections[task.id] ?? "none" : mode;
        if (taskMode === "none" || taskMode === "individual") return null;
        const nextDueDate = taskMode === "tomorrow" ? nextDate : weekBounds(currentDate).weekEnd;
        const historyItem: RescheduleHistoryItem = {
          rescheduled_at: now(),
          from_due_date: task.due_date,
          to_due_date: nextDueDate,
          destination: taskMode === "tomorrow" ? "tomorrow" : "this_week"
        };
        return {
          ...task,
          due_date: nextDueDate,
          status: "todo" as const,
          reschedule_count: taskRescheduleCount(task) + 1,
          last_rescheduled_at: historyItem.rescheduled_at,
          rescheduled_from: task.due_date,
          rescheduled_to: nextDueDate,
          reschedule_history: [...(task.reschedule_history ?? []), historyItem],
          updated_at: now()
        };
      })
      .filter(Boolean) as Task[];

    const nextData: AppData = {
      ...data,
      tasks: data.tasks.map((task) => tasksToUpdate.find((updated) => updated.id === task.id) ?? task)
    };

    if (cloudMode) {
      for (const task of tasksToUpdate) {
        const saved = await persist("tasks", task);
        if (!saved) return;
      }
    } else if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(nextData));
      } catch {
        setNotice({ type: "error", message: "ローカル保存に失敗しました。翌日へ切り替えていません。" });
        return;
      }
    }

    rolloverUndoRef.current = { data: previousData, journalDate: currentDate };
    if (typeof window !== "undefined") window.localStorage.setItem(journalDateKey, nextDate);
    setData(nextData);
    setJournalDate(nextDate);
    setRolloverOpen(false);
    setReflectionDirty(false);
    setNotice({
      type: "success",
      message: "翌日に切り替えました",
      actionLabel: "元に戻す",
      onAction: () => void undoJournalRollover()
    });
  }

  async function undoJournalRollover() {
    const snapshot = rolloverUndoRef.current;
    if (!snapshot) return;
    const ok = window.confirm("翌日切り替え後の編集も、切り替え前の状態へ戻ります。元に戻しますか？");
    if (!ok) return;

    if (cloudMode) {
      for (const task of snapshot.data.tasks) {
        const currentTask = data.tasks.find((item) => item.id === task.id);
        if (currentTask && JSON.stringify(currentTask) !== JSON.stringify(task)) {
          const saved = await persist("tasks", task);
          if (!saved) return;
        }
      }
    } else if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot.data));
      } catch {
        setNotice({ type: "error", message: "ローカル保存に失敗しました。元に戻せませんでした。" });
        return;
      }
    }

    if (typeof window !== "undefined") window.localStorage.setItem(journalDateKey, snapshot.journalDate);
    setData(snapshot.data);
    setJournalDate(snapshot.journalDate);
    rolloverUndoRef.current = null;
    setNotice({ type: "success", message: "元に戻しました" });
  }

  async function archiveInboxItem(item: InboxItem) {
    const updated: InboxItem = { ...item, status: "archived", updated_at: now() };
    upsertLocal("inbox", updated);
    await persist("inbox_items", updated);
  }

  async function convertInboxItem(item: InboxItem, target: "dream" | "goal" | "task") {
    if (target === "dream") {
      const dream: Dream = {
        id: crypto.randomUUID(),
        user_id: userId,
        title: item.title,
        reason: item.memo,
        deadline: null,
        category: uncategorizedPillar,
        desired_state: "",
        status: "active",
        priority: data.dreams.length + 1,
        created_at: now(),
        updated_at: now()
      };
      upsertLocal("dreams", dream);
      await persist("dreams", dream);
      setTab("dreams");
    }
    if (target === "goal") {
      const goal: Goal = {
        id: crypto.randomUUID(),
        user_id: userId,
        dream_id: null,
        parent_goal_id: null,
        title: item.title,
        description: item.memo,
        level: "monthly",
        deadline: null,
        status: "todo",
        created_at: now(),
        updated_at: now()
      };
      upsertLocal("goals", goal);
      await persist("goals", goal);
      setTab("goals");
    }
    if (target === "task") {
      const task: Task = {
        id: crypto.randomUUID(),
        user_id: userId,
        dream_id: null,
        goal_id: null,
        title: item.title,
        memo: item.memo,
        due_date: null,
        urgent: false,
        important: true,
        status: "todo",
        completed_at: null,
        reschedule_count: 0,
        reschedule_history: [],
        created_at: now(),
        updated_at: now()
      };
      upsertLocal("tasks", task);
      await persist("tasks", task);
      setTab("tasks");
    }
    await archiveInboxItem(item);
  }

  async function saveReflection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const previousTomorrowTasks = new Set(parseLineItems(todayReflection?.tomorrow_text ?? ""));
    const tomorrowTaskTitles = parseLineItems(form.getAll("tomorrow_tasks"));
    const newTomorrowTaskTitles = tomorrowTaskTitles.filter((title) => !previousTomorrowTasks.has(title));
    const reflection: Reflection = {
      id: todayReflection?.id ?? crypto.randomUUID(),
      user_id: userId,
      reflection_date: today(),
      done_text: String(form.get("done_text") ?? ""),
      not_done_text: "",
      dream_progress_text: "",
      tomorrow_text: tomorrowTaskTitles.join("\n"),
      insight_text: String(form.get("insight_text") ?? ""),
      satisfaction_score: todayReflection?.satisfaction_score ?? 3,
      created_at: todayReflection?.created_at ?? now(),
      updated_at: now()
    };
    const tomorrowTasks: Task[] = newTomorrowTaskTitles.map((title) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      dream_id: null,
      goal_id: null,
      title,
      memo: "振り返りから追加",
      due_date: addDays(today(), 1),
      urgent: false,
      important: true,
      status: "todo",
      completed_at: null,
      reschedule_count: 0,
      last_rescheduled_at: null,
      rescheduled_from: null,
      rescheduled_to: null,
      reschedule_history: [],
      recurrence_type: "none",
      recurrence_weekdays: [],
      recurrence_day_of_month: null,
      recurrence_start_date: null,
      recurrence_active: false,
      created_at: now(),
      updated_at: now()
    }));
    const saved = await persist("daily_reflections", reflection);
    if (!saved) return;
    for (const task of tomorrowTasks) {
      const taskSaved = await persist("tasks", task);
      if (!taskSaved) {
        setNotice({ type: "error", message: "振り返りは保存しましたが、明日のタスク保存に失敗しました。" });
        return;
      }
    }
    upsertLocal("reflections", reflection);
    tomorrowTasks.forEach((task) => upsertLocal("tasks", task));
    setReflectionDirty(false);
    setNotice({ type: "success", message: "保存しました" });
  }

  async function saveMotivationCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const existing = editingMotivationCard;
    if (!existing && data.motivationCards.length >= 5) {
      setNotice({ type: "error", message: "モチベーションカードは最大5枚までです。" });
      return;
    }
    const imageFile = form.get("image_file");
    let imageUrl = form.get("remove_image") === "on" ? "" : String(form.get("image_url") ?? existing?.image_url ?? "");
    if (imageFile instanceof File && imageFile.size > 0) {
      if (imageFile.size > 900_000) {
        setNotice({ type: "error", message: "画像は900KB以下を選択してください。" });
        return;
      }
      imageUrl = await readImageFile(imageFile);
    }
    const card: MotivationCard = {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: userId,
      title: String(form.get("title") ?? ""),
      body: String(form.get("body") ?? ""),
      kind: String(form.get("kind") ?? "reason") as MotivationCard["kind"],
      image_url: imageUrl,
      sort_order: Number(form.get("sort_order") ?? existing?.sort_order ?? data.motivationCards.length + 1),
      visible: form.get("visible") === "on",
      created_at: existing?.created_at ?? now(),
      updated_at: now()
    };
    const saved = await persist("motivation_cards", card);
    if (!saved) return;
    upsertLocal("motivationCards", card);
    setEditingMotivationCardId(null);
    if (!existing) setMotivationCardFormVersion((version) => version + 1);
    setNotice({ type: "success", message: "保存しました" });
  }

  async function toggleMotivationCard(card: MotivationCard) {
    const updated: MotivationCard = { ...card, visible: !card.visible, updated_at: now() };
    const saved = await persist("motivation_cards", updated);
    if (!saved) return;
    upsertLocal("motivationCards", updated);
    setNotice({ type: "success", message: "保存しました" });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile: Profile = {
      ...data.profile,
      user_id: userId,
      display_name: String(form.get("display_name") ?? ""),
      updated_at: now()
    };
    const saved = await persist("profiles", profile);
    if (!saved) return;
    setData((current) => ({ ...current, profile }));
    setNotice({ type: "success", message: "保存しました" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 pt-5 lg:pl-64 lg:pr-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">AI Dream Note</p>
        </div>
        <div className="rounded-full bg-white/80 px-3 py-2 text-right text-xs font-semibold text-moss shadow-soft">{today()}</div>
      </header>

      {!hasSupabaseConfig && (
        <div className="mb-4 rounded-lg border border-dawn/40 bg-white/80 p-3 text-sm text-ink">
          ローカル保存モードです。Supabaseの環境変数を設定するとクラウド保存に切り替わります。
        </div>
      )}

      {notice && <NoticeBar notice={notice} onClose={() => setNotice(null)} />}

      {tab === "home" && (
        <section className="space-y-4">
          <MotivationCardStrip cards={visibleMotivationCards} startIndex={motivationCardIndex} onEdit={() => setTab("settings")} />
          <Panel title="今日やること" icon={ListChecks}>
            <HomeTodayPanel
              suggestion={todayAiSuggestion?.output_json}
              todayTasks={todayTasks}
              tasks={data.tasks}
              dreams={data.dreams}
              goals={data.goals}
              loading={aiTodayLoading}
              canGenerate={todayAiInput.tasks.length > 0}
              onGenerate={() => void generateTodayActionsWithAi()}
              onComplete={completeTask}
              onEdit={(task) => {
                setTaskDraft(null);
                setEditingTaskId(task.id);
                setTab("tasks");
              }}
              onArchive={archiveTask}
              onReschedule={(task) => setReschedulingTaskId(task.id)}
            />
          </Panel>
          <HomeGoalCarousel
            twentyYearGoals={homeTwentyYearGoals}
            tenYearGoals={homeTenYearGoals}
            fiveYearGoals={homeFiveYearGoals}
            yearGoals={homeYearGoals}
            monthlyGoals={homeMonthlyGoals}
            weeklyGoals={homeWeeklyGoals}
            goals={data.goals}
            tasks={data.tasks}
            completionRecords={data.taskCompletionRecords}
            dreams={data.dreams}
            onOpenGoals={(level) => {
              setSelectedGoalLevel(level);
              setEditingGoalId(null);
              setGoalDraft({ level, status: "todo" });
              setTab("goals");
            }}
          />
          <TodayCompletedPanel
            records={todayCompletionRecords}
            tasks={data.tasks}
            dreams={data.dreams}
            goals={data.goals}
            onUndo={(record) => void undoTaskCompletion(record)}
            onEditTask={(task) => {
              setTaskDraft(null);
              setEditingTaskId(task.id);
              setTab("tasks");
            }}
            onUpdateTime={(record, timeValue) => void updateCompletionTime(record, timeValue)}
          />
        </section>
      )}

      {tab === "dreams" && (
        <section className="space-y-4">
          <Panel title={editingDream ? "夢を編集" : "夢を入力"} icon={Sparkles}>
            <DreamForm key={editingDream?.id ?? `new-dream-${dreamFormVersion}`} dream={editingDream} onSubmit={saveDream} onCancel={() => setEditingDreamId(null)} />
          </Panel>
          {data.dreams.length > 0 && (
            <Panel title="6本の柱" icon={Flag}>
              <DreamPillarOverview dreams={data.dreams} />
            </Panel>
          )}
          <Panel title="夢一覧" icon={Trophy}>
            {data.dreams.length === 0 ? (
              <Empty text="まずはひとつ、期限つきの夢を書いてみましょう。" />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {data.dreams.map((dream) => (
                  <DreamCard
                    key={dream.id}
                    dream={dream}
                    goals={data.goals.filter((goal) => goal.dream_id === dream.id && goal.status !== "archived")}
                    tasks={data.tasks.filter((task) => task.dream_id === dream.id && task.status !== "archived")}
                    onStatus={(status) => void updateDreamStatus(dream, status)}
                    onEdit={() => setEditingDreamId(dream.id)}
                    onArchive={() => void updateDreamStatus(dream, "paused")}
                    onDelete={() => void deleteDream(dream)}
                    onClarify={() => void clarifyDreamWithAi(dream)}
                    aiLoading={aiLoadingDreamId === dream.id}
                  />
                ))}
              </div>
            )}
          </Panel>
          {selectedSuggestion && (
            <AiSuggestionPanel
              suggestion={selectedSuggestion}
              onAdoptAll={adoptAllAiSuggestion}
              onAdoptDream={adoptClarifiedDream}
              onAdoptMilestone={adoptMilestone}
              onAdoptAction={adoptFirstAction}
              onReject={(suggestion) => void updateSuggestionStatus(suggestion, "rejected")}
              onClose={() => setSelectedSuggestionId(null)}
            />
          )}
          <Panel title="AI夢整理" icon={Sparkles}>
            <p className="text-sm leading-6 text-ink/75">
              AIは主役ではなく補助です。今後、夢を6本の柱へ整理したり、5年・1年・月・週・今日へ分解する作業を手伝います。
            </p>
          </Panel>
        </section>
      )}

      {tab === "goals" && (
        <section className="space-y-4">
          <Panel title={editingGoal ? "目標を編集" : "目標設定"} icon={Target}>
            <GoalForm
              key={editingGoal?.id ?? `new-goal-${goalFormVersion}`}
              dreams={linkableDreams}
              goals={activeGoals}
              tasks={data.tasks}
              inbox={data.inbox}
              completionRecords={data.taskCompletionRecords}
              goal={editingGoal}
              draft={goalDraft}
              onSubmit={saveGoal}
              onCancel={() => {
                setEditingGoalId(null);
                setGoalDraft(null);
              }}
            />
          </Panel>
          <Panel title="計画の流れ" icon={CalendarDays}>
            {activeGoals.length === 0 ? (
              <Empty text="夢を5年、1年、今月、今週、今日へ分解します。全部を一度に作らなくても大丈夫です。" />
            ) : (
              <GoalPlanFlow
                goals={activeGoals}
                dreams={data.dreams}
                tasks={data.tasks}
                completionRecords={data.taskCompletionRecords}
                selectedLevel={selectedGoalLevel}
                onSelectLevel={setSelectedGoalLevel}
                onEdit={(goal) => {
                  setGoalDraft(null);
                  setEditingGoalId(goal.id);
                }}
                onArchive={(goal) => void archiveGoal(goal)}
                onDelete={(goal) => void deleteGoal(goal)}
                onDecompose={startDecomposeGoal}
              />
            )}
          </Panel>
        </section>
      )}

      {tab === "tasks" && (
        <section className="space-y-4">
          <Panel title={editingTask ? "タスクを編集" : "タスク入力"} icon={Plus}>
            <TaskForm
              key={editingTask?.id ?? `new-task-${taskFormVersion}`}
              dreams={linkableDreams}
              goals={activeGoals}
              task={editingTask}
              draft={taskDraft}
              onSubmit={saveTask}
              onCancel={() => {
                setEditingTaskId(null);
                setTaskDraft(null);
              }}
            />
          </Panel>
        </section>
      )}

      {tab === "matrix" && (
        <section className="space-y-4">
          <Panel title="タスク4分類" icon={ClipboardList}>
            <Matrix
              tasks={activeTasks}
              dreams={data.dreams}
              goals={data.goals}
              onComplete={completeTask}
              onEdit={(task) => {
                setEditingTaskId(task.id);
                setTab("tasks");
              }}
              onArchive={archiveTask}
              onReschedule={(task) => setReschedulingTaskId(task.id)}
            />
          </Panel>
        </section>
      )}

      {tab === "inbox" && (
        <section className="space-y-4">
          <Panel title={editingInboxItem ? "メモ・気づきを編集" : "メモ・気づき"} icon={Inbox}>
            <InboxForm
              key={editingInboxItem?.id ?? `new-inbox-${inboxFormVersion}`}
              item={editingInboxItem}
              onSubmit={saveInboxItem}
              onCancel={() => setEditingInboxId(null)}
            />
          </Panel>
          <Panel title="未整理のメモ・気づき" icon={Archive}>
            <InboxList
              items={data.inbox.filter((item) => item.status === "open")}
              onEdit={(item) => setEditingInboxId(item.id)}
              onArchive={archiveInboxItem}
              onConvert={convertInboxItem}
            />
          </Panel>
        </section>
      )}

      {tab === "reflect" && (
        <section className="space-y-4">
          <Panel title="週次レビューAI" icon={CalendarDays}>
            <WeeklyReviewPanel
              review={weeklyAiReview?.output_json}
              input={weeklyReviewInput}
              loading={aiWeeklyLoading}
              onGenerate={() => void generateWeeklyReviewWithAi()}
            />
          </Panel>
          <Panel title="今日の振り返り" icon={Moon}>
            <ReflectionForm
              reflection={todayReflection}
              records={todayCompletionRecords}
              incompleteCount={rolloverIncompleteTasks.length}
              onSubmit={saveReflection}
              onDirty={() => setReflectionDirty(true)}
              onRolloverRequest={() => {
                if (reflectionDirty && !window.confirm("未保存の振り返りがあります。保存せずに翌日切り替えへ進みますか？")) return;
                setRolloverOpen(true);
              }}
            />
          </Panel>
        </section>
      )}

      {tab === "settings" && (
        <section className="space-y-4">
          <Panel title="設定" icon={Settings}>
            <form onSubmit={saveProfile} className="space-y-4">
              <Field label="表示名">
                <input name="display_name" defaultValue={data.profile.display_name} className="input" />
              </Field>
              <button className="primary-button" type="submit">
                保存
              </button>
            </form>
          </Panel>
          <Panel title="モチベーションカード" icon={Heart}>
            <MotivationCardManager
              key={editingMotivationCard?.id ?? `new-motivation-${motivationCardFormVersion}`}
              cards={data.motivationCards}
              editingCard={editingMotivationCard}
              onSubmit={saveMotivationCard}
              onEdit={(card) => setEditingMotivationCardId(card.id)}
              onCancel={() => setEditingMotivationCardId(null)}
              onToggle={(card) => void toggleMotivationCard(card)}
            />
          </Panel>
          <Panel title="ログイン" icon={LogOut}>
            {hasSupabaseConfig ? (
              user ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink/75">{user.email} でログイン中です。</p>
                  <button className="secondary-button" onClick={() => void logout()}>
                    ログアウト
                  </button>
                </div>
              ) : (
                <form onSubmit={login} className="space-y-3">
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    placeholder="メールアドレス"
                    className="input"
                  />
                  <button className="primary-button" type="submit">
                    ログインリンクを送る
                  </button>
                  {authMessage && <p className="text-sm text-moss">{authMessage}</p>}
                </form>
              )
            ) : (
              <p className="text-sm leading-6 text-ink/75">
                `.env.local` にSupabase URLとAnon Keyを設定すると、メールログインとクラウド保存が有効になります。
              </p>
            )}
          </Panel>
        </section>
      )}

      {reschedulingTask && (
        <RescheduleDialog
          task={reschedulingTask}
          onClose={() => setReschedulingTaskId(null)}
          onReschedule={(destination, customDate) => void rescheduleTask(reschedulingTask, destination, customDate)}
        />
      )}

      {rolloverOpen && (
        <JournalRolloverDialog
          currentDate={today()}
          nextDate={addDays(today(), 1)}
          tasks={rolloverIncompleteTasks}
          onClose={() => setRolloverOpen(false)}
          onSwitch={(mode, selections) => void switchToNextJournalDay(mode, selections)}
        />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-mist bg-paper/95 px-0.5 py-2 backdrop-blur lg:bottom-auto lg:left-5 lg:top-5 lg:w-52 lg:rounded-lg lg:border lg:p-3 lg:shadow-soft">
        <div className="mx-auto grid max-w-md grid-cols-8 gap-0 lg:max-w-none lg:grid-cols-1 lg:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const selected = tab === item.key;
            return (
              <button
                key={item.key}
                className={`tap-highlight flex min-h-14 flex-col items-center justify-center rounded-lg text-[10px] font-semibold lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm ${
                  selected ? "bg-ink text-white" : "text-ink/65"
                }`}
                onClick={() => {
                  if (item.key === "goals") {
                    setSelectedGoalLevel(null);
                    setGoalDraft(null);
                    setEditingGoalId(null);
                  }
                  setTab(item.key);
                }}
              >
                <Icon className="mb-1 h-4 w-4 lg:mb-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

function NoticeBar({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  return (
    <div
      className={`mb-4 flex items-start justify-between gap-3 rounded-lg border p-3 text-sm ${
        notice.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-leaf/30 bg-white/80 text-moss"
      }`}
    >
      <p>{notice.message}</p>
      <div className="flex shrink-0 items-center gap-2">
        {notice.actionLabel && notice.onAction && (
          <button
            className="rounded-md bg-white px-2 py-1 text-xs font-bold text-clay"
            onClick={() => {
              notice.onAction?.();
              onClose();
            }}
          >
            {notice.actionLabel}
          </button>
        )}
        <button className="rounded-md p-1" onClick={onClose} aria-label="通知を閉じる">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/88 p-4 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-xl bg-mist p-2 text-moss">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <label className="mb-1 block text-sm font-bold text-ink">{label}</label>
      {hint && <p className="mb-2 text-xs leading-5 text-ink/55">{hint}</p>}
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg bg-mist/70 p-4 text-sm leading-6 text-ink/70">{text}</p>;
}

function HeroStats({ dreams, goals, tasks }: { dreams: Dream[]; goals: Goal[]; tasks: Task[] }) {
  const done = tasks.filter((task) => task.status === "done").length;
  return (
    <section className="grid grid-cols-3 gap-2">
      {[
        ["夢", dreams.filter((dream) => dream.status !== "paused").length],
        ["目標", goals.filter((goal) => goal.status !== "archived").length],
        ["完了", done]
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg bg-ink p-4 text-white shadow-soft">
          <p className="text-xs font-semibold text-white/65">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
      ))}
    </section>
  );
}

function RedPenText({ children }: { children: React.ReactNode }) {
  return <span className="red-pen-text">{children}</span>;
}

function TodayCompletedPanel({
  records,
  tasks,
  dreams,
  goals,
  onUndo,
  onEditTask,
  onUpdateTime
}: {
  records: TaskCompletionRecord[];
  tasks: Task[];
  dreams: Dream[];
  goals: Goal[];
  onUndo: (record: TaskCompletionRecord) => void;
  onEditTask: (task: Task) => void;
  onUpdateTime: (record: TaskCompletionRecord, timeValue: string) => void;
}) {
  if (records.length === 0) return null;
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const dreamById = new Map(dreams.map((dream) => [dream.id, dream]));
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));

  return (
    <Panel title="今日やり遂げたこと" icon={PenLine}>
      <div className="space-y-3">
        <div className="rounded-lg bg-dawn/15 p-3 text-sm font-bold text-clay">今日は夢に{records.length}歩近づきました。</div>
        <div className="space-y-2">
          {records.slice(0, 6).map((record) => {
            const task = taskById.get(record.task_id);
            const goal = goalById.get(record.goal_id ?? task?.goal_id ?? "");
            const dream = dreamById.get(record.dream_id ?? task?.dream_id ?? goal?.dream_id ?? "");
            return (
              <article key={record.id} className="rounded-lg border border-mist bg-white/90 p-3">
                <h3 className="break-words font-bold text-ink">
                  <RedPenText>{record.title_snapshot}</RedPenText>
                </h3>
                {(goal || dream) && (
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-moss">
                    {goal?.title ?? "目標未設定"}
                    {dream ? ` / ${dream.title}` : ""}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form
                    className="flex min-w-[9rem] flex-1 items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      onUpdateTime(record, String(form.get("completed_time") ?? ""));
                    }}
                  >
                    <input name="completed_time" type="time" defaultValue={timeInputValue(record.completed_at)} className="input min-h-10 py-2 text-sm" />
                    <button className="mini-button shrink-0" type="submit">
                      時刻訂正
                    </button>
                  </form>
                  {task && (
                    <button className="mini-button" onClick={() => onEditTask(task)}>
                      <Edit3 className="h-3.5 w-3.5" /> 内容修正
                    </button>
                  )}
                  <button className="mini-button" onClick={() => onUndo(record)}>
                    <Undo2 className="h-3.5 w-3.5" /> 完了を取り消す
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function MotivationCardStrip({
  cards,
  startIndex,
  onEdit
}: {
  cards: MotivationCard[];
  startIndex: number;
  onEdit: () => void;
}) {
  if (cards.length === 0) return null;
  const orderedCards = [...cards.slice(startIndex), ...cards.slice(0, startIndex)].slice(0, 5);
  return (
    <section className="rounded-lg border border-mist bg-white/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-moss">今日の原点</p>
        <button className="text-xs font-bold text-clay" onClick={onEdit}>
          編集
        </button>
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {orderedCards.map((card) => (
          <article key={card.id} className="min-w-[86%] snap-start rounded-lg bg-mist/60 p-3 sm:min-w-[20rem]">
            <div className="flex items-start gap-3">
              {card.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white text-clay">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-clay">{motivationKindLabels[card.kind]}</p>
                <h3 className="mt-1 line-clamp-1 font-bold text-ink">{card.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink/70">{card.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MotivationCardManager({
  cards,
  editingCard,
  onSubmit,
  onEdit,
  onCancel,
  onToggle
}: {
  cards: MotivationCard[];
  editingCard?: MotivationCard;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (card: MotivationCard) => void;
  onCancel: () => void;
  onToggle: (card: MotivationCard) => void;
}) {
  const [imageValue, setImageValue] = useState(editingCard?.image_url ?? "");
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    setImageValue(editingCard?.image_url ?? "");
    setRemoveImage(false);
  }, [editingCard?.id, editingCard?.image_url]);

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="タイトル">
          <input name="title" required defaultValue={editingCard?.title} className="input" />
        </Field>
        <Field label="本文">
          <textarea name="body" rows={3} required defaultValue={editingCard?.body} className="input" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="種類">
            <select name="kind" defaultValue={editingCard?.kind ?? "reason"} className="input">
              {Object.entries(motivationKindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="並び順">
            <input name="sort_order" type="number" min={1} defaultValue={editingCard?.sort_order ?? cards.length + 1} className="input" />
          </Field>
        </div>
        <Field label="画像を登録">
          <input type="hidden" name="image_url" value={imageValue} />
          <input type="hidden" name="remove_image" value={removeImage ? "on" : ""} />
          <input
            name="image_file"
            type="file"
            accept="image/*"
            className="input"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              if (file.size > 900_000) {
                setImageValue("");
                setRemoveImage(false);
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                setImageValue(String(reader.result ?? ""));
                setRemoveImage(false);
              };
              reader.readAsDataURL(file);
            }}
          />
          {imageValue && !removeImage && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-mist/60 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageValue} alt="" className="h-14 w-14 rounded-xl object-cover" />
              <button type="button" className="mini-button flex-none" onClick={() => setRemoveImage(true)}>
                <X className="h-3.5 w-3.5" /> 画像を削除
              </button>
            </div>
          )}
        </Field>
        <label className="toggle">
          <input name="visible" type="checkbox" defaultChecked={editingCard?.visible ?? true} />
          <span>ホームに表示</span>
        </label>
        <FormActions editing={Boolean(editingCard)} saveLabel={editingCard ? "カードを更新" : "カードを保存"} onCancel={onCancel} />
      </form>
      {cards.length > 0 && (
        <div className="space-y-2">
          {cards
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
            .map((card) => (
              <article key={card.id} className="rounded-lg border border-mist bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-clay">{motivationKindLabels[card.kind]}</p>
                    <h3 className="mt-1 line-clamp-1 font-bold text-ink">{card.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-ink/60">{card.body}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-mist px-2 py-1 text-xs font-bold text-moss">{card.visible ? "表示" : "非表示"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="mini-button" onClick={() => onEdit(card)}>
                    <Edit3 className="h-3.5 w-3.5" /> 編集
                  </button>
                  <button className="mini-button" onClick={() => onToggle(card)}>
                    <Archive className="h-3.5 w-3.5" /> {card.visible ? "非表示" : "表示"}
                  </button>
                </div>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}

function HomeTodayPanel({
  suggestion,
  todayTasks,
  tasks,
  dreams,
  goals,
  loading,
  canGenerate,
  onGenerate,
  onComplete,
  onEdit,
  onArchive,
  onReschedule
}: {
  suggestion?: TodayAiSuggestionOutput;
  todayTasks: Task[];
  tasks: Task[];
  dreams: Dream[];
  goals: Goal[];
  loading: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onComplete: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
  onArchive: (task: Task) => Promise<void>;
  onReschedule: (task: Task) => void;
}) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const dreamById = new Map(dreams.map((dream) => [dream.id, dream]));
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));
  const recommendationByTaskId = new Map(suggestion?.recommendations.map((recommendation) => [recommendation.task_id, recommendation]) ?? []);
  const aiOrderedTasks =
    suggestion?.recommendations
      .map((recommendation) => taskById.get(recommendation.task_id))
      .filter((task): task is Task => Boolean(task)) ?? [];
  const remainingTasks = todayTasks.filter((task) => !aiOrderedTasks.some((orderedTask) => orderedTask.id === task.id));
  const orderedTasks = [...aiOrderedTasks, ...remainingTasks];
  const primaryTask = orderedTasks[0];
  const secondaryTasks = orderedTasks.slice(1, 5);

  if (!primaryTask) {
    return (
      <div className="space-y-3">
        <Empty text="今日やる候補はまだありません。重要タスク、期限つきタスク、夢に紐づくタスクを追加してください。" />
        <button className="secondary-button" onClick={onGenerate} disabled={loading || !canGenerate}>
          <Sparkles className="h-4 w-4" /> {loading ? "整理中" : "AIで候補を整理"}
        </button>
      </div>
    );
  }

  const renderTask = (task: Task, prominent = false) => {
    const dream = dreamById.get(task.dream_id ?? "");
    const goal = goalById.get(task.goal_id ?? "");
    const recommendation = recommendationByTaskId.get(task.id);
    return (
      <article key={task.id} className={`${prominent ? "border-ink bg-white p-4" : "border-mist bg-white/90 p-3"} rounded-lg border`}>
        <div className="flex items-start gap-3">
          <button
            aria-label="タスクを完了"
            onClick={() => void onComplete(task)}
            className={`${prominent ? "h-12 w-12" : "h-10 w-10"} mt-0.5 flex shrink-0 items-center justify-center rounded-full border border-leaf text-leaf`}
          >
            <Check className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <span className={`rounded-full px-2 py-1 text-xs font-bold ${matrixBadgeClass(task)}`}>{matrixLabel(task)}</span>
              <span className={`rounded-full px-2 py-1 text-xs font-bold ${dateDistance(task.due_date) <= 3 ? "bg-dawn/20 text-clay" : "bg-mist text-moss"}`}>
                {dueLabel(task.due_date)}
              </span>
              {recommendation && <span className="rounded-full bg-ink px-2 py-1 text-xs font-bold text-white">{recommendation.priority_label}</span>}
              {isRecurringTask(task) && (
                <span className="rounded-full bg-leaf/15 px-2 py-1 text-xs font-bold text-moss">
                  <Repeat2 className="inline h-3 w-3" /> {recurrenceLabels[taskRecurrenceType(task)]}
                </span>
              )}
              {taskRescheduleCount(task) > 0 && <span className="rounded-full bg-dawn/20 px-2 py-1 text-xs font-bold text-clay">転記{taskRescheduleCount(task)}回</span>}
            </div>
            <h3 className={`${prominent ? "text-lg" : "text-base"} mt-2 font-bold text-ink`}>{task.title}</h3>
            {recommendation?.reason && <p className="mt-1 text-sm leading-6 text-ink/70">{recommendation.reason}</p>}
            <TaskPlanTrail task={task} dream={dream} goal={goal} goals={goals} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="mini-button" onClick={() => onEdit(task)}>
                <Edit3 className="h-3.5 w-3.5" /> 編集
              </button>
              <button className="mini-button" onClick={() => onReschedule(task)}>
                <CalendarDays className="h-3.5 w-3.5" /> 転記
              </button>
              <button className="mini-button" onClick={() => void onArchive(task)}>
                <Archive className="h-3.5 w-3.5" /> 保留
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-ink p-3 text-white">
        <p className="text-xs font-semibold text-white/65">まずこれ</p>
        <p className="mt-1 text-sm font-bold">{suggestion?.headline ?? "今日の最初の行動"}</p>
      </div>
      {renderTask(primaryTask, true)}
      {secondaryTasks.length > 0 && <div className="grid gap-2 lg:grid-cols-2">{secondaryTasks.map((task) => renderTask(task))}</div>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-ink/55">
          {suggestion?.summary ?? "期限、重要度、夢・目標とのつながりから今日の候補を表示しています。"}
        </p>
        <button className="secondary-button shrink-0 sm:w-auto" onClick={onGenerate} disabled={loading || !canGenerate}>
          <Sparkles className="h-4 w-4" /> {loading ? "整理中" : suggestion ? "AI整理済み" : "AIで整理"}
        </button>
      </div>
    </div>
  );
}

function HomeGoalCarousel({
  twentyYearGoals,
  tenYearGoals,
  fiveYearGoals,
  yearGoals,
  monthlyGoals,
  weeklyGoals,
  goals,
  tasks,
  completionRecords,
  dreams,
  onOpenGoals
}: {
  twentyYearGoals: Goal[];
  tenYearGoals: Goal[];
  fiveYearGoals: Goal[];
  monthlyGoals: Goal[];
  yearGoals: Goal[];
  weeklyGoals: Goal[];
  goals: Goal[];
  tasks: Task[];
  completionRecords: TaskCompletionRecord[];
  dreams: Dream[];
  onOpenGoals: (level: GoalLevel) => void;
}) {
  const dreamById = new Map(dreams.map((dream) => [dream.id, dream]));
  const cards = [
    {
      key: "weekly",
      period: "今週",
      icon: ClipboardList,
      level: "weekly" as GoalLevel,
      goals: weeklyGoals,
      emptyText: "今週目標を登録"
    },
    {
      key: "monthly",
      period: "今月",
      icon: CalendarDays,
      level: "monthly" as GoalLevel,
      goals: monthlyGoals,
      emptyText: "今月目標を登録"
    },
    {
      key: "year",
      period: "1年後",
      icon: Target,
      level: "one_year" as GoalLevel,
      goals: yearGoals,
      emptyText: "1年後の目標を登録"
    },
    {
      key: "five-year",
      period: "5年後",
      icon: CalendarDays,
      level: "five_year" as GoalLevel,
      goals: fiveYearGoals,
      emptyText: "5年後の目標を登録"
    },
    {
      key: "ten-year",
      period: "10年後",
      icon: Trophy,
      level: "ten_year" as GoalLevel,
      goals: tenYearGoals,
      emptyText: "10年後の目標を登録"
    },
    {
      key: "twenty-year",
      period: "20年後",
      icon: Flag,
      level: "twenty_year" as GoalLevel,
      goals: twentyYearGoals,
      emptyText: "20年後の目標を登録"
    }
  ];

  return (
    <section aria-label="期間別目標カード" className="-mx-4 overflow-hidden pl-4">
      <div className="mb-2 flex items-center justify-between gap-2 pr-4">
        <p className="text-xs font-bold text-moss">期間別目標</p>
        <p className="text-[11px] font-semibold text-ink/45">横にスワイプ</p>
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((card) => {
          const goal = card.goals[0];
          const dream = goal ? dreamById.get(goal.dream_id ?? "") : undefined;
          const Icon = card.icon;
          const progress = goal ? goalProgress(goal, goals, tasks, completionRecords) : null;
          const childItems = goal
            ? [
                ...progress!.childGoals.map((child) => child.title),
                ...progress!.childTasks.map((task) => task.title)
              ].slice(0, 3)
            : [];
          const total = progress?.total ?? 0;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onOpenGoals(card.level)}
              className="tap-highlight min-w-[78%] snap-start rounded-lg border border-white/80 bg-white/90 p-3 text-left shadow-soft sm:min-w-[14rem] lg:min-w-[15rem]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-clay">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-mist text-moss">
                    <Icon size={15} />
                  </span>
                  {card.period}
                </span>
                <span className="shrink-0 rounded-full bg-mist px-2 py-1 text-[11px] font-semibold text-moss">
                  {goal ? dueLabel(goal.deadline) : "未設定"}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-bold text-moss">目標</p>
              <h2 className="line-clamp-1 text-sm font-bold leading-5 text-ink">
                {goal?.title ?? card.emptyText}
              </h2>
              <p className="mt-1 line-clamp-1 text-[11px] text-ink/50">
                {goal ? `関連：${dream?.title ?? "未紐づけ"}` : "タップして追加"}
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-[11px] font-bold text-moss">達成するためのタスク</p>
                {childItems.length > 0 ? (
                  childItems.map((item) => (
                    <p key={item} className="line-clamp-1 text-[11px] leading-4 text-ink/60">
                      ・{item}
                    </p>
                  ))
                ) : (
                  <p className="text-[11px] leading-4 text-ink/45">下位項目はあとから追加できます。</p>
                )}
              </div>
              {(card.goals.length > 1 || childItems.length < total) && (
                <p className="mt-1 text-[11px] font-semibold text-moss">
                  他 {Math.max(card.goals.length - 1, total - childItems.length)} 件
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TaskPlanTrail({ task, dream, goal, goals }: { task: Task; dream?: Dream; goal?: Goal; goals: Goal[] }) {
  const trail = goal ? goalAncestors(goal.id, goals) : [];
  if (!dream && trail.length === 0) {
    return <p className="mt-2 text-xs leading-5 text-ink/45">上位計画：未紐づけ</p>;
  }
  const directLabel = trail[0] ? `${goalLabels[trail[0].level]}「${trail[0].title}」` : dream ? `既存データ「${dream.title}」` : "未紐づけ";
  return (
    <details className="mt-2 rounded-lg bg-mist/50 px-3 py-2 text-xs text-moss">
      <summary className="cursor-pointer list-none font-bold">
        上位計画：{directLabel}
      </summary>
      <div className="mt-2 space-y-1 leading-5">
        <p>今日「{task.title}」</p>
        {trail.map((item) => (
          <p key={item.id}>
            → {goalLabels[item.level]}「{item.title}」
          </p>
        ))}
        {dream && <p>→ 既存データ「{dream.title}」</p>}
      </div>
    </details>
  );
}

function HomeGoalList({
  goals,
  dreams,
  emptyText,
  compact = false
}: {
  goals: Goal[];
  dreams: Dream[];
  emptyText: string;
  compact?: boolean;
}) {
  const dreamById = new Map(dreams.map((dream) => [dream.id, dream]));
  if (goals.length === 0) return <Empty text={emptyText} />;
  return (
    <div className={`${compact ? "space-y-2" : "grid gap-2 lg:grid-cols-3"}`}>
      {goals.map((goal) => {
        const dream = dreamById.get(goal.dream_id ?? "");
        return (
          <article key={goal.id} className="rounded-lg border border-mist bg-white/90 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-clay">{goalLabels[goal.level]}</p>
                <h3 className="mt-1 line-clamp-2 font-bold text-ink">{goal.title}</h3>
              </div>
              <span className="shrink-0 rounded-full bg-mist px-2 py-1 text-xs font-semibold text-moss">{dueLabel(goal.deadline)}</span>
            </div>
            {dream && <p className="mt-2 line-clamp-1 text-xs text-moss">{dream.title}</p>}
          </article>
        );
      })}
    </div>
  );
}

function TodayAiPanel({
  suggestion,
  tasks,
  dreams,
  goals,
  loading,
  canGenerate,
  onGenerate,
  onComplete,
  onEdit
}: {
  suggestion?: TodayAiSuggestionOutput;
  tasks: Task[];
  dreams: Dream[];
  goals: Goal[];
  loading: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onComplete: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
}) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const dreamById = new Map(dreams.map((dream) => [dream.id, dream]));
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));
  const recommendations =
    suggestion?.recommendations
      .map((recommendation) => {
        const task = taskById.get(recommendation.task_id);
        return task ? { recommendation, task } : null;
      })
      .filter((item): item is { recommendation: TodayAiSuggestionOutput["recommendations"][number]; task: Task } => Boolean(item)) ?? [];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-ink">{suggestion?.headline ?? "今日の優先順をAIで整理"}</p>
          <p className="mt-1 text-xs leading-5 text-ink/65">
            {suggestion?.summary ?? "既存の今日候補から、夢につながる重要行動を含めておすすめ順を出します。"}
          </p>
        </div>
        <button className="primary-button shrink-0" onClick={onGenerate} disabled={loading || !canGenerate}>
          <Sparkles className="h-4 w-4" /> {loading ? "生成中" : suggestion ? "最新です" : "AIで整理"}
        </button>
      </div>

      {!canGenerate && <Empty text="AIに渡せる候補がありません。まず重要タスク、期限つきタスク、夢に紐づくタスクを追加してください。" />}

      {recommendations.length > 0 && (
        <div className="space-y-2">
          {recommendations.map(({ recommendation, task }) => {
            const dream = dreamById.get(task.dream_id ?? "");
            const goal = goalById.get(task.goal_id ?? "");
            return (
              <article key={task.id} className="rounded-lg border border-mist bg-white p-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                    {recommendation.suggested_order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-dawn/20 px-2 py-1 text-xs font-bold text-clay">{recommendation.priority_label}</span>
                      <span className="rounded-full bg-mist px-2 py-1 text-xs font-bold text-moss">{dueLabel(task.due_date)}</span>
                    </div>
                    <h3 className="mt-2 font-bold text-ink">{task.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-ink/70">{recommendation.reason}</p>
                    <p className="mt-2 text-xs leading-5 text-moss">
                      {recommendation.dream_connection}
                      {(dream || goal) && (
                        <>
                          <br />
                          {dream?.title ?? "未紐づけ"} / {goal?.title ?? "未紐づけ"}
                        </>
                      )}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="mini-button" onClick={() => void onComplete(task)}>
                        <Check className="h-3.5 w-3.5" /> 完了
                      </button>
                      <button className="mini-button" onClick={() => onEdit(task)}>
                        <Edit3 className="h-3.5 w-3.5" /> 編集
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs leading-5 text-ink/55">
        AIは既存タスクのおすすめ順だけを提案します。タスクの追加、削除、完了はあなたが操作した時だけ反映されます。
        {suggestion?.caution ? ` ${suggestion.caution}` : ""}
      </p>
    </div>
  );
}

function WeeklyReviewPanel({
  review,
  input,
  loading,
  onGenerate
}: {
  review?: WeeklyReviewOutput;
  input: WeeklyReviewInput;
  loading: boolean;
  onGenerate: () => void;
}) {
  const hasReviewSource = input.completed_tasks.length > 0 || input.reflections.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-ink">
            {review?.headline ?? `${input.week_start}〜${input.week_end} の振り返り`}
          </p>
          <p className="mt-1 text-xs leading-5 text-ink/65">
            完了{input.stats.completed_total}件 / 第2領域{input.stats.second_quadrant_completed}件 / 振り返り{input.reflections.length}日
          </p>
        </div>
        <button className="primary-button shrink-0" onClick={onGenerate} disabled={loading || !hasReviewSource}>
          <Sparkles className="h-4 w-4" /> {loading ? "生成中" : review ? "最新です" : "AIで週次レビュー"}
        </button>
      </div>

      {!hasReviewSource && <Empty text="今週の完了タスクまたは日次振り返りを保存すると、週次レビューAIを生成できます。" />}

      {review && (
        <div className="grid gap-3 lg:grid-cols-3">
          <ReviewBlock title="今週の事実" items={review.facts} />
          <ReviewBlock title="AIの気づき" items={[review.urgent_bias, review.second_quadrant_summary, ...review.insights].slice(0, 5)} />
          <ReviewBlock title="来週の重点" items={review.next_week_focus} />
        </div>
      )}

      {review && review.neglected_dreams.length > 0 && (
        <div className="rounded-lg bg-mist/70 p-3">
          <p className="text-sm font-bold text-ink">放置されている夢</p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-ink/70">
            {review.neglected_dreams.slice(0, 5).map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs leading-5 text-ink/55">
        週次レビューAIは既存データを変更しません。来週の重点は、必要に応じて自分でタスク化してください。
        {review?.caution ? ` ${review.caution}` : ""}
      </p>
    </div>
  );
}

function ReviewBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-mist bg-white p-3">
      <h3 className="font-bold text-ink">{title}</h3>
      <ul className="mt-2 space-y-1 text-sm leading-6 text-ink/70">
        {items.slice(0, 5).map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </section>
  );
}

const deadlineShortcuts = [
  { label: "1年後", years: 1 },
  { label: "3年後", years: 3 },
  { label: "5年後", years: 5 },
  { label: "10年後", years: 10 },
  { label: "20年後", years: 20 },
  { label: "30年後", years: 30 }
];

function dateAfterYears(years: number) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function DeadlineInput({ name, defaultValue }: { name: string; defaultValue?: DateValue }) {
  const textRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const setValue = (value: string) => {
    if (textRef.current) textRef.current.value = value;
    if (dateRef.current) dateRef.current.value = value;
  };

  return (
    <div className="space-y-2">
      <input
        ref={textRef}
        name={name}
        type="text"
        inputMode="numeric"
        defaultValue={defaultValue ?? ""}
        placeholder="YYYY-MM-DD"
        pattern="\d{4}[-/.]\d{1,2}[-/.]\d{1,2}"
        className="input"
      />
      <input
        ref={dateRef}
        type="date"
        defaultValue={defaultValue ?? ""}
        aria-label="カレンダーで期限を選択"
        className="input"
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {deadlineShortcuts.map((shortcut) => (
          <button
            key={shortcut.years}
            type="button"
            className="tap-highlight min-h-10 rounded-lg bg-mist px-2 py-2 text-xs font-bold text-moss transition active:scale-[0.99]"
            onClick={() => {
              setValue(dateAfterYears(shortcut.years));
            }}
          >
            {shortcut.label}
          </button>
        ))}
      </div>
      <p className="text-xs leading-5 text-ink/55">日付を直接入力しても、上のボタンでざっくり決めてもOKです。</p>
    </div>
  );
}

function TaskDueDateInput({ defaultValue }: { defaultValue?: DateValue }) {
  const textRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <input
        ref={textRef}
        name="due_date"
        type="text"
        inputMode="numeric"
        defaultValue={defaultValue ?? ""}
        placeholder="YYYY-MM-DD"
        pattern="\d{4}[-/.]\d{1,2}[-/.]\d{1,2}"
        className="input"
      />
      <div className="flex items-center gap-2">
        <input
          type="date"
          defaultValue={defaultValue ?? ""}
          aria-label="カレンダーで期限を選択"
          className="input min-w-0 flex-1"
          onChange={(event) => {
            if (textRef.current) textRef.current.value = event.target.value;
          }}
        />
      </div>
      <p className="text-xs leading-5 text-ink/55">手入力は YYYY-MM-DD。カレンダーで選ぶこともできます。</p>
    </div>
  );
}

function PillarSelect({ currentCategory }: { currentCategory?: string }) {
  const selected = currentCategory ? displayDreamPillar(currentCategory) : dreamPillars[0];
  const legacyCategory = currentCategory && !isDreamPillar(currentCategory) && !legacyCategoryToPillar[currentCategory] ? currentCategory : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {dreamPillars.map((pillar) => (
          <label
            key={pillar}
            className="tap-highlight flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-mist bg-white px-3 py-2 text-sm font-bold text-ink transition has-[:checked]:border-moss has-[:checked]:bg-moss has-[:checked]:text-white"
          >
            <input className="sr-only" type="radio" name="category" value={pillar} defaultChecked={selected === pillar} />
            {pillar}
          </label>
        ))}
        {legacyCategory && (
          <label className="tap-highlight col-span-2 flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-dashed border-clay/40 bg-mist px-3 py-2 text-sm font-bold text-clay transition has-[:checked]:border-clay has-[:checked]:bg-clay has-[:checked]:text-white sm:col-span-3">
            <input className="sr-only" type="radio" name="category" value={legacyCategory} defaultChecked />
            未分類（現在: {legacyCategory}）
          </label>
        )}
      </div>
      <p className="text-xs leading-5 text-ink/55">まず柱と達成日を決めると、5年・1年・月・週・今日へ逆算しやすくなります。</p>
    </div>
  );
}

function DreamForm({
  dream,
  onSubmit,
  onCancel
}: {
  dream?: Dream;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form key={dream?.id ?? "new-dream"} onSubmit={onSubmit} className="space-y-4">
      <Field label="6本の柱" hint="夢をどの領域で育てるかを選びます。">
        <PillarSelect currentCategory={dream?.category} />
      </Field>
      <Field label="夢">
        <input name="title" required defaultValue={dream?.title} placeholder="例：1年後に起業する" className="input" />
      </Field>
      <Field label="達成日">
        <DeadlineInput name="deadline" defaultValue={dream?.deadline} />
      </Field>
      <Field label="内容" hint="なぜ実現したいか、どんな状態になりたいかを短く書きます。">
        <textarea name="reason" rows={3} defaultValue={dream?.reason} placeholder="例：自分の強みを活かして、家族との時間も大切にできる働き方にしたい" className="input" />
      </Field>
      <Field label="達成したい状態">
        <textarea name="desired_state" rows={3} defaultValue={dream?.desired_state} placeholder="例：最初の商品を販売し、継続して収益が出始めている" className="input" />
      </Field>
      <FormActions editing={Boolean(dream)} saveLabel={dream ? "夢を更新" : "夢を保存"} onCancel={onCancel} />
    </form>
  );
}

function DreamPillarOverview({ dreams }: { dreams: Dream[] }) {
  const activeDreams = dreams.filter((dream) => dream.status !== "achieved");
  const grouped = dreamPillars.map((pillar) => ({
    pillar,
    dreams: activeDreams.filter((dream) => displayDreamPillar(dream.category) === pillar)
  }));
  const uncategorizedDreams = activeDreams.filter((dream) => displayDreamPillar(dream.category) === uncategorizedPillar);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {grouped.map(({ pillar, dreams: pillarDreams }) => (
          <section key={pillar} className="rounded-lg border border-mist bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink">{pillar}</h3>
              <span className="rounded-full bg-mist px-2 py-1 text-xs font-bold text-moss">{pillarDreams.length}</span>
            </div>
            {pillarDreams.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs leading-5 text-ink/70">
                {pillarDreams.slice(0, 3).map((dream) => (
                  <li key={dream.id} className="truncate">
                    {dream.title}
                    {dream.deadline ? ` / ${dream.deadline}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs leading-5 text-ink/50">まだ夢がありません。</p>
            )}
          </section>
        ))}
      </div>
      {uncategorizedDreams.length > 0 && (
        <section className="rounded-lg border border-dashed border-clay/40 bg-white p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-clay">未分類</h3>
            <span className="rounded-full bg-mist px-2 py-1 text-xs font-bold text-moss">{uncategorizedDreams.length}</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-ink/60">
            旧カテゴリーの夢です。編集時に6本の柱へ移せますが、保存済みデータは勝手に変更しません。
          </p>
        </section>
      )}
    </div>
  );
}

function DreamCard({
  dream,
  goals,
  tasks,
  onStatus,
  onEdit,
  onArchive,
  onDelete,
  onClarify,
  aiLoading
}: {
  dream: Dream;
  goals: Goal[];
  tasks: Task[];
  onStatus: (status: Dream["status"]) => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onClarify: () => void;
  aiLoading: boolean;
}) {
  return (
    <article className="rounded-lg border border-mist bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-clay">
            {displayDreamPillar(dream.category)}
            {displayDreamPillar(dream.category) === uncategorizedPillar && dream.category && dream.category !== uncategorizedPillar ? `（${dream.category}）` : ""}
          </p>
          <h3 className="mt-1 text-lg font-bold text-ink">{dream.title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-mist px-2 py-1 text-xs font-semibold text-moss">達成日 {dream.deadline || "未設定"}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-ink/70">{dream.reason || dream.desired_state}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-moss">
        <span>目標 {goals.length}</span>
        <span>タスク {tasks.length}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="mini-button" onClick={onEdit}>
          <Edit3 className="h-3.5 w-3.5" /> 編集
        </button>
        <button className="mini-button" onClick={onClarify} disabled={aiLoading}>
          <Sparkles className="h-3.5 w-3.5" /> {aiLoading ? "AI処理中" : "AIで具体化"}
        </button>
        <button className="mini-button" onClick={() => onStatus("achieved")}>
          達成
        </button>
        <button className="mini-button" onClick={onArchive}>
          <Archive className="h-3.5 w-3.5" /> 保留
        </button>
        <button className="mini-button" onClick={() => onStatus("active")}>
          進行中
        </button>
        <button className="mini-button text-clay" onClick={onDelete}>
          <X className="h-3.5 w-3.5" /> 削除
        </button>
      </div>
    </article>
  );
}

function AiSuggestionPanel({
  suggestion,
  onAdoptAll,
  onAdoptDream,
  onAdoptMilestone,
  onAdoptAction,
  onReject,
  onClose
}: {
  suggestion: AiSuggestionRecord;
  onAdoptAll: (suggestion: AiSuggestionRecord, drafts: AiDreamSuggestionOutput) => Promise<void>;
  onAdoptDream: (suggestion: AiSuggestionRecord, clarified: AiDreamSuggestionOutput["clarified_dream"]) => Promise<void>;
  onAdoptMilestone: (suggestion: AiSuggestionRecord, milestone: AiDreamSuggestionOutput["milestones"][number]) => Promise<void>;
  onAdoptAction: (suggestion: AiSuggestionRecord, action: AiDreamSuggestionOutput["first_actions"][number]) => Promise<void>;
  onReject: (suggestion: AiSuggestionRecord) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AiDreamSuggestionOutput>(suggestion.output_json);

  useEffect(() => setDraft(suggestion.output_json), [suggestion.id, suggestion.output_json]);

  const updateMilestone = (index: number, patch: Partial<AiDreamSuggestionOutput["milestones"][number]>) => {
    setDraft((current) => ({
      ...current,
      milestones: current.milestones.map((milestone, i) => (i === index ? { ...milestone, ...patch } : milestone))
    }));
  };

  const updateAction = (index: number, patch: Partial<AiDreamSuggestionOutput["first_actions"][number]>) => {
    setDraft((current) => ({
      ...current,
      first_actions: current.first_actions.map((action, i) => (i === index ? { ...action, ...patch } : action))
    }));
  };

  return (
    <Panel title="AI提案" icon={Sparkles}>
      <div className="space-y-4">
        <div className="rounded-lg bg-mist/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="font-bold text-ink">あなたの夢</h3>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-moss">{suggestion.status}</span>
          </div>
          <Field label="具体化した夢">
            <input
              className="input"
              value={draft.clarified_dream.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  clarified_dream: { ...current.clarified_dream, title: event.target.value }
                }))
              }
            />
          </Field>
          <div className="mt-3 space-y-3">
            <Field label="説明">
              <textarea
                className="input"
                rows={3}
                value={draft.clarified_dream.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    clarified_dream: { ...current.clarified_dream, description: event.target.value }
                  }))
                }
              />
            </Field>
            <Field label="達成状態">
              <textarea
                className="input"
                rows={3}
                value={draft.clarified_dream.success_definition}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    clarified_dream: { ...current.clarified_dream, success_definition: event.target.value }
                  }))
                }
              />
            </Field>
          </div>
          <button className="secondary-button mt-3" onClick={() => void onAdoptDream(suggestion, draft.clarified_dream)}>
            夢を更新
          </button>
        </div>

        {draft.assumptions.length > 0 && (
          <div className="rounded-lg border border-dawn/30 bg-white p-3">
            <h3 className="font-bold text-ink">この前提で提案しています</h3>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-ink/70">
              {draft.assumptions.map((assumption) => (
                <li key={assumption}>・{assumption}</li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="mb-2 font-bold text-ink">目標候補</h3>
          <div className="space-y-3">
            {draft.milestones.map((milestone, index) => (
              <div key={`${milestone.title}-${index}`} className="rounded-lg border border-mist bg-white p-3">
                <Field label="目標">
                  <input className="input" value={milestone.title} onChange={(event) => updateMilestone(index, { title: event.target.value })} />
                </Field>
                <div className="mt-3 space-y-3">
                  <Field label="内容">
                    <textarea
                      className="input"
                      rows={3}
                      value={milestone.description}
                      onChange={(event) => updateMilestone(index, { description: event.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="目安">
                      <input
                        className="input"
                        value={milestone.target_period}
                        onChange={(event) => updateMilestone(index, { target_period: event.target.value })}
                      />
                    </Field>
                    <Field label="階層">
                      <select
                        className="input"
                        value={milestone.suggested_goal_level}
                        onChange={(event) =>
                          updateMilestone(index, { suggested_goal_level: event.target.value as Goal["level"] })
                        }
                      >
                        {newGoalLevels.map((value) => (
                          <option key={value} value={value}>
                            {goalLabels[value]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
                <button className="secondary-button mt-3" onClick={() => void onAdoptMilestone(suggestion, milestone)}>
                  この目標を採用
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-bold text-ink">最初の一歩</h3>
          <div className="space-y-3">
            {draft.first_actions.map((action, index) => (
              <div key={`${action.title}-${index}`} className="rounded-lg border border-dawn/40 bg-white p-3">
                <Field label="行動">
                  <input className="input" value={action.title} onChange={(event) => updateAction(index, { title: event.target.value })} />
                </Field>
                <div className="mt-3 space-y-3">
                  <Field label="理由">
                    <textarea className="input" rows={3} value={action.reason} onChange={(event) => updateAction(index, { reason: event.target.value })} />
                  </Field>
                  <Field label="完了条件">
                    <textarea
                      className="input"
                      rows={2}
                      value={action.completion_condition ?? ""}
                      onChange={(event) => updateAction(index, { completion_condition: event.target.value })}
                    />
                  </Field>
                  <Field label="目安時間">
                    <input
                      className="input"
                      type="number"
                      min="15"
                      max="60"
                      value={action.estimated_minutes}
                      onChange={(event) => updateAction(index, { estimated_minutes: Number(event.target.value) })}
                    />
                  </Field>
                </div>
                <button className="primary-button mt-3" onClick={() => void onAdoptAction(suggestion, action)}>
                  タスクとして採用
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="primary-button flex-1" onClick={() => void onAdoptAll(suggestion, draft)}>
            全部採用
          </button>
          <button className="secondary-button flex-1" onClick={() => onReject(suggestion)}>
            採用しない
          </button>
          <button className="secondary-button flex-1" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </Panel>
  );
}

function GoalForm({
  dreams,
  goals,
  tasks,
  inbox,
  completionRecords,
  goal,
  draft,
  onSubmit,
  onCancel
}: {
  dreams: Dream[];
  goals: Goal[];
  tasks: Task[];
  inbox: InboxItem[];
  completionRecords: TaskCompletionRecord[];
  goal?: Goal;
  draft?: Partial<Goal> | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const initialDreamId = goal?.dream_id ?? draft?.dream_id ?? "";
  const initialLevel = goal?.level ?? draft?.level ?? "monthly";
  const [selectedDreamId, setSelectedDreamId] = useState(initialDreamId);
  const [selectedLevel, setSelectedLevel] = useState<GoalLevel>(initialLevel);
  const [relatedFilter, setRelatedFilter] = useState("");
  const [childInputs, setChildInputs] = useState([""]);

  useEffect(() => {
    setSelectedDreamId(goal?.dream_id ?? draft?.dream_id ?? "");
    setSelectedLevel(goal?.level ?? draft?.level ?? "monthly");
    setRelatedFilter("");
    setChildInputs([""]);
  }, [goal?.id, goal?.dream_id, goal?.level, draft?.dream_id, draft?.level]);

  const blockedParentIds = goal ? goalDescendantIds(goal.id, goals) : new Set<string>();
  const parentCandidates = goals
    .filter((candidate) => candidate.id !== goal?.id)
    .filter((candidate) => !blockedParentIds.has(candidate.id))
    .filter((candidate) => candidate.status !== "archived")
    .filter((candidate) => !selectedDreamId || !candidate.dream_id || candidate.dream_id === selectedDreamId)
    .filter((candidate) => parentGoalLevelsByLevel[selectedLevel]?.includes(candidate.level))
    .sort(sortGoalsByPlan);
  const childGoalItems = goal ? goals.filter((candidate) => parentGoalId(candidate) === goal.id && candidate.status !== "archived").sort(sortGoalsByPlan) : [];
  const childTaskItems = goal ? tasks.filter((task) => task.goal_id === goal.id && task.status !== "archived").sort((a, b) => dateDistance(a.due_date) - dateDistance(b.due_date) || a.created_at.localeCompare(b.created_at)) : [];
  const completionTaskIds = new Set(completionRecords.map((record) => record.task_id));
  const nextStep = nextPlanStep(selectedLevel);
  const childLabel = nextStep === "task" ? "今日やることへ追加" : nextStep ? `${goalLabels[nextStep]}へ追加` : "下位項目を追加";
  const filterText = relatedFilter.trim().toLowerCase();
  const filteredDreams = dreams.filter((dream) => !filterText || `${dream.title} ${dream.reason} ${dream.desired_state}`.toLowerCase().includes(filterText));
  const selectedDream = dreams.find((dream) => dream.id === selectedDreamId);
  const dreamOptions = [...(selectedDream ? [selectedDream] : []), ...filteredDreams].filter((dream, index, list) => list.findIndex((item) => item.id === dream.id) === index).slice(0, 10);
  const relatedPreviewItems = [
    ...goals
      .filter((candidate) => candidate.id !== goal?.id)
      .filter((candidate) => !filterText || candidate.title.toLowerCase().includes(filterText))
      .slice(0, 4)
      .map((candidate) => `目標: ${candidate.title}`),
    ...tasks
      .filter((task) => !filterText || task.title.toLowerCase().includes(filterText))
      .slice(0, 4)
      .map((task) => `タスク: ${task.title}`),
    ...inbox
      .filter((item) => item.status !== "archived")
      .filter((item) => !filterText || `${item.title} ${item.memo}`.toLowerCase().includes(filterText))
      .slice(0, 4)
      .map((item) => `メモ: ${item.title}`)
  ].slice(0, 6);

  return (
    <form key={goal?.id ?? `new-goal-${draft?.parent_goal_id ?? "blank"}-${draft?.level ?? "monthly"}`} onSubmit={onSubmit} className="space-y-4">
      <Field label="目標">
        <input name="title" required defaultValue={goal?.title ?? draft?.title ?? ""} placeholder="例：月商100万円を達成する" className="input" />
      </Field>
      <Field label="達成するためのタスク" hint={`${childLabel}します。1行に1つずつ入力できます。`}>
        {(childGoalItems.length > 0 || childTaskItems.length > 0) && (
          <div className="mb-3 space-y-2 rounded-lg border border-mist bg-mist/40 p-3">
            {childGoalItems.map((child) => (
              <div key={child.id} className="flex items-start justify-between gap-2 text-sm">
                <span className={child.status === "done" ? "red-pen-text" : "text-ink"}>{child.title}</span>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-moss">{goalLabels[child.level]}</span>
              </div>
            ))}
            {childTaskItems.map((task) => {
              const done = task.status === "done" || completionTaskIds.has(task.id);
              return (
                <div key={task.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className={done ? "red-pen-text" : "text-ink"}>{task.title}</span>
                  <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-bold text-moss">今日</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="space-y-2">
          {childInputs.map((value, index) => (
            <div key={index} className="rounded-lg border border-mist bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-moss">タスク {index + 1}</span>
                <button
                  type="button"
                  className="tap-highlight rounded-full p-2 text-ink/55 transition hover:bg-mist"
                  aria-label="タスク入力を削除"
                  onClick={() =>
                    setChildInputs((items) => {
                      if (items.length === 1) return [""];
                      return items.filter((_, itemIndex) => itemIndex !== index);
                    })
                  }
                >
                  <X size={16} />
                </button>
              </div>
              <input
                name="child_items"
                value={value}
                onChange={(event) =>
                  setChildInputs((items) => items.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                }
                placeholder={index === 0 ? "例：楽天市場50万円" : "例：店舗30万円"}
                className="input"
              />
            </div>
          ))}
          <button
            type="button"
            className="tap-highlight flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-moss/35 bg-mist/40 px-3 py-2 text-sm font-bold text-moss"
            onClick={() => setChildInputs((items) => [...items, ""])}
          >
            <Plus size={16} />
            タスクを追加
          </button>
        </div>
      </Field>
      <Field label="期間設定">
        <select name="level" value={selectedLevel} onChange={(event) => setSelectedLevel(event.target.value as GoalLevel)} className="input">
          {newGoalLevels.map((level) => (
            <option key={level} value={level}>
              {goalLabels[level]}
            </option>
          ))}
          {goal && legacyGoalLevels.includes(goal.level as (typeof legacyGoalLevels)[number]) && (
            <option value={goal.level}>{goalLabels[goal.level]}</option>
          )}
        </select>
      </Field>
      <Field label="達成日" hint="カレンダーでも手入力でも設定できます。">
        <DeadlineInput name="deadline" defaultValue={goal?.deadline ?? draft?.deadline} />
      </Field>

      <details className="rounded-lg border border-mist bg-white/70 p-3" open={Boolean(goal?.description || goal?.parent_goal_id || selectedDreamId)}>
        <summary className="cursor-pointer select-none text-sm font-bold text-ink">詳細設定</summary>
        <div className="mt-4 space-y-4">
          <Field label="6本の柱">
            <PillarSelect currentCategory={goal?.category ?? draft?.category ?? undefined} />
          </Field>
          <Field label="上位項目" hint="未選択でも保存できます。現在より長期の項目だけ表示します。">
            <select key={`${goal?.id ?? "new"}-${selectedDreamId}-${selectedLevel}-${draft?.parent_goal_id ?? ""}`} name="parent_goal_id" defaultValue={goal?.parent_goal_id ?? draft?.parent_goal_id ?? ""} className="input">
              <option value="">未設定</option>
              {parentCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {goalLabels[candidate.level]}・{candidate.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="関連する既存データ">
            <input value={relatedFilter} onChange={(event) => setRelatedFilter(event.target.value)} placeholder="夢・目標・タスク・メモを検索" className="input mb-2" />
            <select name="dream_id" value={selectedDreamId} onChange={(event) => setSelectedDreamId(event.target.value)} className="input">
              <option value="">関連づけなし</option>
              {dreamOptions.map((dream) => (
                <option key={dream.id} value={dream.id}>
                  夢・{dream.title}
                </option>
              ))}
            </select>
            {relatedPreviewItems.length > 0 && (
              <div className="mt-2 grid gap-1 text-xs leading-5 text-ink/60">
                {relatedPreviewItems.map((item) => (
                  <span key={item} className="truncate rounded-md bg-mist px-2 py-1">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </Field>
          <Field label="メモ">
            <textarea name="description" rows={3} defaultValue={goal?.description ?? draft?.description ?? ""} className="input" />
          </Field>
        </div>
      </details>
      <FormActions editing={Boolean(goal)} saveLabel={goal ? "目標を更新" : "目標を保存"} onCancel={onCancel} />
    </form>
  );
}

function GoalPlanFlow({
  goals,
  dreams,
  tasks,
  completionRecords,
  selectedLevel,
  onSelectLevel,
  onEdit,
  onArchive,
  onDelete,
  onDecompose
}: {
  goals: Goal[];
  dreams: Dream[];
  tasks: Task[];
  completionRecords: TaskCompletionRecord[];
  selectedLevel: GoalLevel | null;
  onSelectLevel: (level: GoalLevel | null) => void;
  onEdit: (goal: Goal) => void;
  onArchive: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onDecompose: (goal: Goal) => void;
}) {
  const dreamById = new Map(dreams.map((dream) => [dream.id, dream]));
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));
  const activeNewGoals = goals.filter((goal) => (newGoalLevels as readonly string[]).includes(goal.level)).sort(sortGoalsByPlan);
  const legacyGoals = goals.filter((goal) => (legacyGoalLevels as readonly string[]).includes(goal.level)).sort(sortGoalsByPlan);
  const visibleLevels = selectedLevel ? [selectedLevel] : homeGoalLevels;

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          className={`tap-highlight shrink-0 rounded-full px-3 py-2 text-xs font-bold ${selectedLevel ? "bg-mist text-moss" : "bg-ink text-white"}`}
          onClick={() => onSelectLevel(null)}
        >
          すべて
        </button>
        {homeGoalLevels.map((level) => (
          <button
            key={level}
            type="button"
            className={`tap-highlight shrink-0 rounded-full px-3 py-2 text-xs font-bold ${selectedLevel === level ? "bg-ink text-white" : "bg-mist text-moss"}`}
            onClick={() => onSelectLevel(level)}
          >
            {goalLabels[level]}
          </button>
        ))}
      </div>
      {visibleLevels.map((level) => {
        const goalsInLevel = activeNewGoals.filter((goal) => goal.level === level);
        return (
          <section key={level} className="rounded-lg border border-mist bg-mist/40 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-bold text-ink">{goalLabels[level]}</h3>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-moss">{goalsInLevel.length}</span>
            </div>
            {goalsInLevel.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {goalsInLevel.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    dream={dreamById.get(goal.dream_id ?? "")}
                    parentGoal={goalById.get(parentGoalId(goal) ?? "")}
                    goals={goals}
                    tasks={tasks}
                    completionRecords={completionRecords}
                    onEdit={() => onEdit(goal)}
                    onArchive={() => onArchive(goal)}
                    onDelete={() => onDelete(goal)}
                    onDecompose={() => onDecompose(goal)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-ink/55">まだありません。必要な階層だけ、あとから追加できます。</p>
            )}
          </section>
        );
      })}
      {!selectedLevel && legacyGoals.length > 0 && (
        <section className="rounded-lg border border-dashed border-clay/40 bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-bold text-clay">旧階層</h3>
            <span className="rounded-full bg-mist px-2 py-1 text-xs font-bold text-moss">{legacyGoals.length}</span>
          </div>
          <p className="mb-3 text-xs leading-5 text-ink/60">旧10年・旧3年の目標です。データは残し、編集時に新しい階層へ移せます。</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {legacyGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                dream={dreamById.get(goal.dream_id ?? "")}
                parentGoal={goalById.get(parentGoalId(goal) ?? "")}
                goals={goals}
                tasks={tasks}
                completionRecords={completionRecords}
                onEdit={() => onEdit(goal)}
                onArchive={() => onArchive(goal)}
                onDelete={() => onDelete(goal)}
                onDecompose={() => onDecompose(goal)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  dream,
  parentGoal,
  goals,
  tasks,
  completionRecords,
  onEdit,
  onArchive,
  onDelete,
  onDecompose
}: {
  goal: Goal;
  dream?: Dream;
  parentGoal?: Goal;
  goals: Goal[];
  tasks: Task[];
  completionRecords: TaskCompletionRecord[];
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onDecompose: () => void;
}) {
  const progress = goalProgress(goal, goals, tasks, completionRecords);
  const done = goal.status === "done";
  const nextStep = nextPlanStep(goal.level);
  const pillar = displayDreamPillar(goal.category ?? dream?.category);
  return (
    <article className="rounded-lg border border-mist bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-clay">{goalLabels[goal.level]}</p>
          <h3 className="mt-1 font-bold text-ink">{done ? <RedPenText>{goal.title}</RedPenText> : goal.title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-mist px-2 py-1 text-xs font-semibold text-moss">{goal.deadline || "期限未設定"}</span>
      </div>
      {goal.description && <p className="mt-2 text-sm leading-6 text-ink/70">{goal.description}</p>}
      <p className="mt-3 text-xs text-moss">6本の柱：{pillar}</p>
      {dream && <p className="mt-1 text-xs text-ink/55">既存データ：{dream.title}</p>}
      <p className="mt-1 text-xs text-ink/55">つながる目標：{parentGoal ? `${goalLabels[parentGoal.level]}・${parentGoal.title}` : "未設定"}</p>
      <div className="mt-3 rounded-lg bg-mist/45 p-3">
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-moss">
          <span>実現するためのタスク</span>
          <span>
            {progress.done} / {progress.total}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-leaf" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
        </div>
        <details className="mt-2 text-xs text-ink/65">
          <summary className="cursor-pointer font-bold text-clay">実現するためのタスクを見る</summary>
          <ul className="mt-2 space-y-1 leading-5">
            {progress.childGoals.map((child) => (
              <li key={child.id}>・{child.status === "done" ? <RedPenText>{child.title}</RedPenText> : child.title}</li>
            ))}
            {progress.childTasks.map((task) => (
              <li key={task.id}>・{isTaskEffectivelyDone(task, completionRecords) ? <RedPenText>{task.title}</RedPenText> : task.title}</li>
            ))}
            {progress.total === 0 && <li>・まだタスクはありません</li>}
          </ul>
        </details>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {nextStep && (
          <button className="mini-button bg-mist text-moss" onClick={onDecompose}>
            <Plus className="h-3.5 w-3.5" /> {nextStep === "task" ? "今日の行動へ" : `${goalLabels[nextStep]}へ分解`}
          </button>
        )}
        <button className="mini-button" onClick={onEdit}>
          <Edit3 className="h-3.5 w-3.5" /> 編集
        </button>
        <button className="mini-button" onClick={onArchive}>
          <Archive className="h-3.5 w-3.5" /> アーカイブ
        </button>
        <button className="mini-button text-clay" onClick={onDelete}>
          <X className="h-3.5 w-3.5" /> 削除
        </button>
      </div>
    </article>
  );
}

function TaskForm({
  dreams,
  goals,
  task,
  draft,
  onSubmit,
  onCancel
}: {
  dreams: Dream[];
  goals: Goal[];
  task?: Task;
  draft?: Partial<Task> | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [selectedDreamId, setSelectedDreamId] = useState(task?.dream_id ?? draft?.dream_id ?? "");
  useEffect(() => setSelectedDreamId(task?.dream_id ?? draft?.dream_id ?? ""), [task?.id, task?.dream_id, draft?.dream_id]);
  const availableGoals = goals.filter((goal) => !selectedDreamId || !goal.dream_id || goal.dream_id === selectedDreamId);
  const draftGoalId = task?.goal_id ?? draft?.goal_id ?? "";
  const selectedGoalIsValid = draftGoalId && availableGoals.some((goal) => goal.id === draftGoalId);

  return (
    <form key={task?.id ?? `new-task-${draft?.goal_id ?? "blank"}-${draft?.due_date ?? ""}`} onSubmit={onSubmit} className="space-y-4">
      <Field label="タスク名">
        <input name="title" required defaultValue={task?.title ?? draft?.title ?? ""} placeholder="例：起業計画のメモを書く" className="input" />
      </Field>
      <Field label="メモ">
        <textarea name="memo" rows={3} defaultValue={task?.memo ?? draft?.memo ?? ""} className="input" />
      </Field>
      <Field label="期限">
        <TaskDueDateInput defaultValue={task?.due_date ?? draft?.due_date} />
      </Field>
      <div className="rounded-lg border border-mist bg-white/80 p-3">
        <Field label="繰り返し">
          <select name="recurrence_type" defaultValue={taskRecurrenceType(task ?? ({} as Task))} className="input">
            {Object.entries(recurrenceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="開始日">
            <input
              name="recurrence_start_date"
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              defaultValue={task?.recurrence_start_date ?? task?.due_date ?? draft?.due_date ?? ""}
              className="input"
            />
          </Field>
          <Field label="毎月の日付">
            <input name="recurrence_day_of_month" type="number" min={1} max={31} defaultValue={task?.recurrence_day_of_month ?? ""} className="input" />
          </Field>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
            <label key={weekday} className="toggle justify-center px-2 text-xs">
              <input name="recurrence_weekdays" type="checkbox" value={weekday} defaultChecked={(task?.recurrence_weekdays ?? [1, 2, 3, 4, 5]).includes(weekday)} />
              <span>{["日", "月", "火", "水", "木", "金", "土"][weekday]}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="toggle">
          <input name="urgent" type="checkbox" defaultChecked={task?.urgent ?? draft?.urgent ?? false} />
          <span>緊急</span>
        </label>
        <label className="toggle">
          <input name="important" type="checkbox" defaultChecked={task?.important ?? draft?.important ?? true} />
          <span>重要</span>
        </label>
      </div>
      <p className="rounded-xl bg-leaf/10 px-3 py-2 text-xs font-bold leading-5 text-moss">第Ⅱ領域は「重要・緊急でない」行動です。未来の夢につながる行動はここに入れます。</p>
      <Field label="関連する既存データ">
        <select name="dream_id" className="input" value={selectedDreamId} onChange={(event) => setSelectedDreamId(event.target.value)}>
          <option value="">未紐づけ</option>
          {dreams.map((dream) => (
            <option key={dream.id} value={dream.id}>
              {dream.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="関連する目標">
        <select key={`${task?.id ?? "new"}-${selectedDreamId}-${draft?.goal_id ?? ""}`} name="goal_id" defaultValue={selectedGoalIsValid ? draftGoalId : ""} className="input">
          <option value="">未紐づけ</option>
          {availableGoals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goalLabels[goal.level]}・{goal.title}
            </option>
          ))}
        </select>
      </Field>
      <FormActions editing={Boolean(task)} saveLabel={task ? "タスクを更新" : "タスクを保存"} onCancel={onCancel} />
    </form>
  );
}

function RescheduleDialog({
  task,
  onClose,
  onReschedule
}: {
  task: Task;
  onClose: () => void;
  onReschedule: (destination: RescheduleDestination, customDate?: string) => void;
}) {
  const [customDate, setCustomDate] = useState("");
  const quickDestinations: Array<{ key: RescheduleDestination; label: string; description: string }> = [
    { key: "tomorrow", label: "明日", description: addDays(today(), 1) },
    { key: "this_week", label: "今週中", description: futureOrTomorrow(weekBounds().weekEnd) },
    { key: "next_week", label: "来週", description: nextWeekStart() },
    { key: "this_month", label: "今月", description: futureOrTomorrow(monthEnd()) }
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-ink/35 px-3 pb-3 pt-12 sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-clay">未完了の転記</p>
            <h2 className="mt-1 break-words text-lg font-bold text-ink">{task.title}</h2>
            <p className="mt-1 text-xs text-ink/55">
              現在: {dueLabel(task.due_date)} / 転記{taskRescheduleCount(task)}回
            </p>
          </div>
          <button className="mini-button shrink-0" onClick={onClose} aria-label="閉じる">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {quickDestinations.map((destination) => (
            <button key={destination.key} className="secondary-button justify-start" onClick={() => onReschedule(destination.key)}>
              <CalendarDays className="h-4 w-4" />
              <span className="text-left">
                <span className="block">{destination.label}</span>
                <span className="block text-[11px] font-semibold text-ink/50">{destination.description}</span>
              </span>
            </button>
          ))}
        </div>

        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            onReschedule("custom", customDate);
          }}
        >
          <input
            value={customDate}
            onChange={(event) => setCustomDate(event.target.value)}
            placeholder="YYYY-MM-DD"
            inputMode="numeric"
            className="input"
          />
          <button className="primary-button shrink-0" type="submit">
            日付指定
          </button>
        </form>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button className="secondary-button justify-start" onClick={() => onReschedule("hold")}>
            <Archive className="h-4 w-4" /> いったん保留
          </button>
          <button className="secondary-button justify-start" onClick={() => onReschedule("drop")}>
            <X className="h-4 w-4" /> もうやらない
          </button>
        </div>
      </div>
    </div>
  );
}

function JournalRolloverDialog({
  currentDate,
  nextDate,
  tasks,
  onClose,
  onSwitch
}: {
  currentDate: string;
  nextDate: string;
  tasks: Task[];
  onClose: () => void;
  onSwitch: (mode: RolloverMode, selections?: Record<string, RolloverMode>) => void;
}) {
  const [mode, setMode] = useState<RolloverMode>("tomorrow");
  const [selections, setSelections] = useState<Record<string, RolloverMode>>(() =>
    Object.fromEntries(tasks.map((task) => [task.id, "tomorrow" as RolloverMode]))
  );
  const options: Array<{ key: RolloverMode; label: string; description: string }> = [
    { key: "tomorrow", label: "明日へ転記する", description: `${nextDate} の今日やることへ送ります` },
    { key: "this_week", label: "今週に残す", description: "今週中の未完了行動として残します" },
    { key: "individual", label: "個別に選ぶ", description: "タスクごとに扱いを決めます" },
    { key: "none", label: "変更せず切り替える", description: "未完了タスクはそのまま残します" }
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-ink/35 px-3 pb-3 pt-12 sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-clay">手帳日の切り替え</p>
            <h2 className="mt-1 text-lg font-bold text-ink">{nextDate}へ切り替えます</h2>
            <p className="mt-1 text-sm leading-6 text-ink/65">
              {currentDate} → {nextDate} / 未完了の今日やること: {tasks.length}件
            </p>
          </div>
          <button className="mini-button shrink-0" onClick={onClose} aria-label="閉じる">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {options.map((option) => (
            <label key={option.key} className="toggle items-start">
              <input type="radio" checked={mode === option.key} onChange={() => setMode(option.key)} />
              <span>
                <span className="block">{option.label}</span>
                <span className="block text-xs font-semibold leading-5 text-ink/50">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

        {mode === "individual" && (
          <div className="mt-4 space-y-3 rounded-xl bg-mist/50 p-3">
            <p className="text-sm font-bold text-ink">個別に整理</p>
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <div key={task.id} className="rounded-xl bg-white p-3">
                  <p className="break-words text-sm font-bold text-ink">{task.title}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold">
                    {[
                      ["tomorrow", "明日"],
                      ["this_week", "今週"],
                      ["none", "そのまま"]
                    ].map(([value, label]) => (
                      <label key={value} className="flex items-center justify-center gap-1 rounded-lg border border-mist px-2 py-2">
                        <input
                          type="radio"
                          checked={(selections[task.id] ?? "tomorrow") === value}
                          onChange={() => setSelections((current) => ({ ...current, [task.id]: value as RolloverMode }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink/55">未完了タスクはありません。</p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button className="primary-button" onClick={() => onSwitch(mode, mode === "individual" ? selections : undefined)}>
            翌日に切り替える
          </button>
          <button className="secondary-button" onClick={onClose}>
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  dream,
  goal,
  onComplete,
  onEdit,
  onArchive,
  onReschedule
}: {
  task: Task;
  dream?: Dream;
  goal?: Goal;
  onComplete: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onReschedule?: () => void;
}) {
  return (
    <article className="rounded-lg border border-mist bg-white p-4">
      <div className="flex items-start gap-3">
        <button
          aria-label="タスクを完了"
          onClick={onComplete}
          className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-leaf text-leaf"
        >
          <Check className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${matrixBadgeClass(task)}`}>{matrixLabel(task)}</span>
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${dateDistance(task.due_date) <= 3 ? "bg-dawn/20 text-clay" : "bg-mist text-moss"}`}>
              {dueLabel(task.due_date)}
            </span>
            {taskRescheduleCount(task) > 0 && <span className="rounded-full bg-dawn/20 px-2 py-1 text-xs font-bold text-clay">転記{taskRescheduleCount(task)}回</span>}
            {isRecurringTask(task) && (
              <span className="rounded-full bg-leaf/15 px-2 py-1 text-xs font-bold text-moss">
                <Repeat2 className="inline h-3 w-3" /> {recurrenceLabels[taskRecurrenceType(task)]}
              </span>
            )}
          </div>
          <h3 className="mt-2 font-bold text-ink">{task.title}</h3>
          {task.memo && <p className="mt-1 text-sm leading-6 text-ink/65">{task.memo}</p>}
          <p className="mt-3 text-xs leading-5 text-moss">
            夢：{dream?.title ?? "未紐づけ"}
            <br />
            目標：{goal?.title ?? "未紐づけ"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {onEdit && (
              <button className="mini-button" onClick={onEdit}>
                <Edit3 className="h-3.5 w-3.5" /> 編集
              </button>
            )}
            {onReschedule && (
              <button className="mini-button" onClick={onReschedule}>
                <CalendarDays className="h-3.5 w-3.5" /> 転記
              </button>
            )}
            {onArchive && (
              <button className="mini-button" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> アーカイブ
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Matrix({
  tasks,
  dreams,
  goals,
  onComplete,
  onEdit,
  onArchive,
  onReschedule
}: {
  tasks: Task[];
  dreams: Dream[];
  goals: Goal[];
  onComplete: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
  onArchive: (task: Task) => Promise<void>;
  onReschedule: (task: Task) => void;
}) {
  const groups = [
    ["第Ⅰ領域", "重要・緊急", tasks.filter((task) => task.urgent && task.important)],
    ["第Ⅱ領域", "重要・緊急でない", tasks.filter((task) => !task.urgent && task.important)],
    ["第Ⅲ領域", "緊急・重要でない", tasks.filter((task) => task.urgent && !task.important)],
    ["第Ⅳ領域", "重要でも緊急でもない", tasks.filter((task) => !task.urgent && !task.important)]
  ] as const;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map(([label, description, items]) => (
        <section key={label} className={`rounded-xl p-3 ${label === "第Ⅱ領域" ? "bg-leaf/10 ring-1 ring-leaf/25" : "bg-mist/55"}`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-ink">{label}</h3>
              <p className="text-xs font-bold text-moss">{description}</p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-moss">{items.length}</span>
          </div>
          <div className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-ink/55">該当タスクはありません。</p>
            ) : (
              items.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  dream={dreams.find((dream) => dream.id === task.dream_id)}
                  goal={goals.find((goal) => goal.id === task.goal_id)}
                  onComplete={() => void onComplete(task)}
                  onEdit={() => onEdit(task)}
                  onArchive={() => void onArchive(task)}
                  onReschedule={() => onReschedule(task)}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function InboxForm({
  item,
  onSubmit,
  onCancel
}: {
  item?: InboxItem;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form key={item?.id ?? "new-inbox"} onSubmit={onSubmit} className="space-y-4">
      <Field label="タイトル">
        <input name="title" required defaultValue={item?.title} placeholder="メモ、気づき、いつかやりたいこと" className="input" />
      </Field>
      <Field label="種類">
        <select name="kind" defaultValue={item?.kind ?? "idea"} className="input">
          {Object.entries(inboxKindLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="メモ">
        <textarea name="memo" rows={3} defaultValue={item?.memo} className="input" />
      </Field>
      <FormActions editing={Boolean(item)} saveLabel={item ? "メモを更新" : "メモを保存"} onCancel={onCancel} />
    </form>
  );
}

function InboxList({
  items,
  onEdit,
  onArchive,
  onConvert
}: {
  items: InboxItem[];
  onEdit: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => Promise<void>;
  onConvert: (item: InboxItem, target: "dream" | "goal" | "task") => Promise<void>;
}) {
  if (items.length === 0) return <Empty text="未整理のメモ・気づきはありません。" />;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((item) => (
        <article key={item.id} className="rounded-lg border border-mist bg-white p-4">
          <span className="rounded-full bg-mist px-2 py-1 text-xs font-bold text-moss">{inboxKindLabels[item.kind]}</span>
          <h3 className="mt-2 font-bold text-ink">{item.title}</h3>
          {item.memo && <p className="mt-1 text-sm leading-6 text-ink/65">{item.memo}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="mini-button" onClick={() => onEdit(item)}>
              <Edit3 className="h-3.5 w-3.5" /> 編集
            </button>
            <button className="mini-button" onClick={() => void onConvert(item, "dream")}>
              夢へ
            </button>
            <button className="mini-button" onClick={() => void onConvert(item, "goal")}>
              目標へ
            </button>
            <button className="mini-button" onClick={() => void onConvert(item, "task")}>
              タスクへ
            </button>
            <button className="mini-button" onClick={() => void onArchive(item)}>
              <Archive className="h-3.5 w-3.5" /> アーカイブ
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ReflectionForm({
  reflection,
  records,
  incompleteCount,
  onSubmit,
  onDirty,
  onRolloverRequest
}: {
  reflection?: Reflection;
  records: TaskCompletionRecord[];
  incompleteCount: number;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDirty: () => void;
  onRolloverRequest: () => void;
}) {
  const doneText = records.map((record) => record.title_snapshot).join("\n");
  return (
    <form onSubmit={onSubmit} onChange={onDirty} className="space-y-4">
      <div className="rounded-xl border border-mist bg-mist/50 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-ink">今日やり遂げたこと</p>
          <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-moss">{records.length}件</span>
        </div>
        {records.length > 0 ? (
          <ul className="space-y-1 text-sm leading-6 text-ink/70">
            {records.map((record) => (
              <li key={record.id}>・{record.title_snapshot}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-ink/55">今日はまだ消し込みがありません。</p>
        )}
        <input type="hidden" name="done_text" value={doneText || reflection?.done_text || ""} />
      </div>
      <Field label="気づき">
        <textarea name="insight_text" rows={4} defaultValue={reflection?.insight_text} placeholder="今日気づいたこと、明日につなげたいこと" className="input" />
      </Field>
      <Field label="明日やるタスク" hint="1つずつ書くと、明日のタスクとして追加されます。">
        <textarea name="tomorrow_tasks" rows={3} defaultValue={reflection?.tomorrow_text} placeholder={"例：営業メールを5件送る\n商品ページの写真を差し替える"} className="input" />
      </Field>
      <button type="submit" className="primary-button">
        振り返りを保存
      </button>
      <div className="rounded-xl border border-mist bg-paper p-3">
        <p className="text-xs font-bold text-moss">夜の締め</p>
        <p className="mt-1 text-sm leading-6 text-ink/70">
          振り返りを保存したら、未完了の今日やることを整理して翌日の手帳へ移ります。
        </p>
        <p className="mt-2 text-xs font-bold text-ink/55">未完了の今日やること: {incompleteCount}件</p>
        <button type="button" className="secondary-button mt-3" onClick={onRolloverRequest}>
          翌日に切り替える
        </button>
      </div>
    </form>
  );
}

function FormActions({ editing, saveLabel, onCancel }: { editing: boolean; saveLabel: string; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button type="submit" className="primary-button flex-1">
        {saveLabel}
      </button>
      {editing && (
        <button type="button" className="secondary-button flex-1" onClick={onCancel}>
          キャンセル
        </button>
      )}
    </div>
  );
}
