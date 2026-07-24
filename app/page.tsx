"use client";

import {
  Archive,
  CalendarDays,
  Check,
  ClipboardList,
  Edit3,
  Flag,
  Home,
  Inbox,
  ListChecks,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Target,
  Trophy,
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
  title: string;
  description: string;
  level: "ten_year" | "three_year" | "one_year" | "monthly" | "daily";
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
  profile: Profile;
};

type CollectionKey = "dreams" | "goals" | "tasks" | "inbox" | "aiSuggestions" | "todayAiSuggestions" | "weeklyAiReviews" | "reflections";
type Tab = "home" | "dreams" | "goals" | "tasks" | "matrix" | "inbox" | "reflect" | "settings";
type Notice = { type: "success" | "error"; message: string };

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const localUserId = "local-user";
const storageKey = "ai-dream-note-phase1";

const categories = ["仕事", "お金", "家族", "健康", "学習", "人間関係", "ライフスタイル", "社会貢献", "その他"];

const goalLabels: Record<Goal["level"], string> = {
  ten_year: "10年目標",
  three_year: "3年目標",
  one_year: "1年目標",
  monthly: "今月目標",
  daily: "今日の行動"
};

const inboxKindLabels: Record<InboxItem["kind"], string> = {
  someday: "いつか",
  idea: "アイデア",
  thought: "気づき"
};

const navItems: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: "home", label: "ホーム", icon: Home },
  { key: "dreams", label: "夢", icon: Sparkles },
  { key: "goals", label: "目標", icon: Target },
  { key: "tasks", label: "タスク", icon: Plus },
  { key: "matrix", label: "4分類", icon: ClipboardList },
  { key: "inbox", label: "メモ", icon: Inbox },
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
  reflections: []
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
      profile: { ...base.profile, ...parsed.profile }
    } satisfies AppData;
  } catch {
    return initialData();
  }
}

function dateDistance(date: DateValue) {
  if (!date) return 9999;
  const day = new Date(`${date}T00:00:00`).getTime();
  const base = new Date(`${today()}T00:00:00`).getTime();
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
  if (task.urgent && task.important) return "緊急かつ重要";
  if (!task.urgent && task.important) return "緊急ではないが重要";
  if (task.urgent && !task.important) return "緊急だが重要ではない";
  return "緊急でも重要でもない";
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

function sanitizeForDatabase<T extends Record<string, unknown>>(record: T) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value === "" ? null : value])
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
  const [aiLoadingDreamId, setAiLoadingDreamId] = useState<string | null>(null);
  const [aiTodayLoading, setAiTodayLoading] = useState(false);
  const [aiWeeklyLoading, setAiWeeklyLoading] = useState(false);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);

  const userId = user?.id ?? localUserId;
  const cloudMode = Boolean(supabase && user);
  const editingDream = data.dreams.find((dream) => dream.id === editingDreamId);
  const editingGoal = data.goals.find((goal) => goal.id === editingGoalId);
  const editingTask = data.tasks.find((task) => task.id === editingTaskId);
  const editingInboxItem = data.inbox.find((item) => item.id === editingInboxId);
  const activeGoals = data.goals.filter((goal) => goal.status !== "archived");
  const linkableDreams = data.dreams.filter((dream) => dream.status === "active");

  useEffect(() => {
    setData(getStoredData());
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
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      setNotice({ type: "error", message: "ローカル保存に失敗しました。ブラウザの空き容量や権限を確認してください。" });
    }
  }, [data, loaded]);

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
      const [dreams, goals, tasks, inboxItems, aiSuggestions, todayAiSuggestions, weeklyAiReviews, reflections, profiles] = await Promise.all([
        supabase.from("dreams").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("goals").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("tasks").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("inbox_items").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("ai_suggestions").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("today_ai_suggestions").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("weekly_ai_reviews").select("*").eq("user_id", activeUserId).order("created_at", { ascending: false }),
        supabase.from("daily_reflections").select("*").eq("user_id", activeUserId).order("reflection_date", { ascending: false }),
        supabase.from("profiles").select("*").eq("user_id", activeUserId).maybeSingle()
      ]);
      const firstError = [dreams, goals, tasks, inboxItems, aiSuggestions, todayAiSuggestions, weeklyAiReviews, reflections, profiles].find((result) => result.error)?.error;
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

  const recentlyActedDreamIds = useMemo(() => {
    const goalMap = new Map(data.goals.map((goal) => [goal.id, goal]));
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    return new Set(
      data.tasks
        .filter((task) => task.status === "done" && task.completed_at && new Date(task.completed_at).getTime() >= sevenDaysAgo)
        .map((task) => task.dream_id ?? goalMap.get(task.goal_id ?? "")?.dream_id)
        .filter(Boolean) as string[]
    );
  }, [data.tasks, data.goals]);

  const todayTasks = useMemo(() => {
    const goalMap = new Map(data.goals.map((goal) => [goal.id, goal]));
    const dreamIdFor = (task: Task) => task.dream_id ?? goalMap.get(task.goal_id ?? "")?.dream_id ?? null;
    const score = (task: Task) => {
      const distance = dateDistance(task.due_date);
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
        const distance = dateDistance(task.due_date);
        const linkedDreamId = dreamIdFor(task);
        return task.urgent || task.important || distance <= 3 || Boolean(linkedDreamId && !recentlyActedDreamIds.has(linkedDreamId));
      })
      .sort((a, b) => score(b) - score(a));
  }, [activeTasks, data.goals, recentlyActedDreamIds]);

  const todayAiInput = useMemo<TodayAiSuggestionInput>(() => {
    const goalMap = new Map(data.goals.map((goal) => [goal.id, goal]));
    const dreamMap = new Map(data.dreams.map((dream) => [dream.id, dream]));
    const taskDreamId = (task: Task) => task.dream_id ?? goalMap.get(task.goal_id ?? "")?.dream_id ?? null;
    const mostRecentReflection = [...data.reflections].sort((a, b) => b.reflection_date.localeCompare(a.reflection_date))[0];

    return {
      date: today(),
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
          days_until_due: task.due_date ? dateDistance(task.due_date) : null,
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
  }, [data.dreams, data.goals, data.reflections, recentlyActedDreamIds, todayTasks]);

  const todayAiContextHash = useMemo(() => simpleHash(JSON.stringify(todayAiInput)), [todayAiInput]);
  const todayAiSuggestion = useMemo(
    () =>
      data.todayAiSuggestions
        .filter(
          (suggestion) =>
            suggestion.status === "active" &&
            suggestion.suggestion_date === today() &&
            suggestion.context_hash === todayAiContextHash
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0],
    [data.todayAiSuggestions, todayAiContextHash]
  );

  const homeMonthlyGoals = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.level === "monthly")
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

  const homeFutureGoals = useMemo(
    () =>
      activeGoals
        .filter((goal) => goal.level === "three_year" || goal.level === "ten_year")
        .sort((a, b) => dateDistance(a.deadline) - dateDistance(b.deadline))
        .slice(0, 4),
    [activeGoals]
  );

  const currentWeek = useMemo(() => weekBounds(), []);
  const weeklyReviewInput = useMemo<WeeklyReviewInput>(() => {
    const goalMap = new Map(data.goals.map((goal) => [goal.id, goal]));
    const dreamMap = new Map(data.dreams.map((dream) => [dream.id, dream]));
    const taskDreamId = (task: Task) => task.dream_id ?? goalMap.get(task.goal_id ?? "")?.dream_id ?? null;
    const inWeek = (date: string | null | undefined) => Boolean(date && date.slice(0, 10) >= currentWeek.weekStart && date.slice(0, 10) <= currentWeek.weekEnd);
    const completedTasks = data.tasks.filter((task) => task.status === "done" && inWeek(task.completed_at));
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
  }, [currentWeek.weekEnd, currentWeek.weekStart, data.dreams, data.goals, data.reflections, data.tasks]);

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
      category: String(form.get("category") ?? "その他"),
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
    if (!existing) event.currentTarget.reset();
    setNotice({ type: "success", message: existing ? "夢を更新しました。" : "夢を保存しました。" });
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
    const goal: Goal = {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: userId,
      dream_id: normalizeId(form.get("dream_id")),
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      level: String(form.get("level") ?? "monthly") as Goal["level"],
      deadline,
      status: existing?.status ?? "todo",
      created_at: existing?.created_at ?? now(),
      updated_at: now()
    };
    const saved = await persist("goals", goal);
    if (!saved) return;
    upsertLocal("goals", goal);
    setEditingGoalId(null);
    if (!existing) event.currentTarget.reset();
    setNotice({ type: "success", message: existing ? "目標を更新しました。" : "目標を保存しました。" });
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
      created_at: existing?.created_at ?? now(),
      updated_at: now()
    };
    const saved = await persist("tasks", task);
    if (!saved) return;
    upsertLocal("tasks", task);
    setEditingTaskId(null);
    if (!existing) event.currentTarget.reset();
    setNotice({ type: "success", message: existing ? "タスクを更新しました。" : "タスクを保存しました。" });
    setTab("matrix");
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
    if (!existing) event.currentTarget.reset();
    setNotice({ type: "success", message: existing ? "メモを更新しました。" : "メモを保存しました。" });
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
    const updated: Task = { ...task, status: "done", completed_at: now(), updated_at: now() };
    upsertLocal("tasks", updated);
    await persist("tasks", updated);
  }

  async function updateDreamStatus(dream: Dream, status: Dream["status"]) {
    const updated: Dream = { ...dream, status, updated_at: now() };
    upsertLocal("dreams", updated);
    await persist("dreams", updated);
  }

  async function archiveGoal(goal: Goal) {
    const updated: Goal = { ...goal, status: "archived", updated_at: now() };
    upsertLocal("goals", updated);
    await persist("goals", updated);
  }

  async function archiveTask(task: Task) {
    const updated: Task = { ...task, status: "archived", updated_at: now() };
    upsertLocal("tasks", updated);
    await persist("tasks", updated);
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
        category: "その他",
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
    const reflection: Reflection = {
      id: todayReflection?.id ?? crypto.randomUUID(),
      user_id: userId,
      reflection_date: today(),
      done_text: String(form.get("done_text") ?? ""),
      not_done_text: String(form.get("not_done_text") ?? ""),
      dream_progress_text: String(form.get("dream_progress_text") ?? ""),
      tomorrow_text: String(form.get("tomorrow_text") ?? ""),
      insight_text: String(form.get("insight_text") ?? ""),
      satisfaction_score: Number(form.get("satisfaction_score") ?? 3),
      created_at: todayReflection?.created_at ?? now(),
      updated_at: now()
    };
    const saved = await persist("daily_reflections", reflection);
    if (!saved) return;
    upsertLocal("reflections", reflection);
    setNotice({ type: "success", message: "今日の振り返りを保存しました。" });
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
    setData((current) => ({ ...current, profile }));
    await persist("profiles", profile);
    setNotice({ type: "success", message: "設定を保存しました。" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-24 pt-5 lg:pl-64 lg:pr-8">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">AI Dream Note</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">夢に日付を。</h1>
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
                setEditingTaskId(task.id);
                setTab("tasks");
              }}
              onArchive={archiveTask}
            />
          </Panel>
          <Panel title="1か月後の目標" icon={Target}>
            <HomeGoalList goals={homeMonthlyGoals} dreams={data.dreams} emptyText="今月の目標を登録すると、今日やる理由が見えやすくなります。" />
          </Panel>
          <Panel title="1年後の目標" icon={CalendarDays}>
            <HomeGoalList goals={homeYearGoals} dreams={data.dreams} emptyText="1年目標を登録すると、中期的な方向を確認できます。" />
          </Panel>
          <Panel title="将来の目標" icon={Flag}>
            <HomeGoalList goals={homeFutureGoals} dreams={data.dreams} emptyText="3年・10年目標を登録すると、長期の方向性を確認できます。" compact />
          </Panel>
        </section>
      )}

      {tab === "dreams" && (
        <section className="space-y-4">
          <Panel title={editingDream ? "夢を編集" : "夢を入力"} icon={Sparkles}>
            <DreamForm dream={editingDream} onSubmit={saveDream} onCancel={() => setEditingDreamId(null)} />
          </Panel>
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
              Phase 2でOpenAI APIと接続します。夢の共通テーマ、カテゴリー、優先順位、次の行動候補を提案する予定です。
            </p>
          </Panel>
        </section>
      )}

      {tab === "goals" && (
        <section className="space-y-4">
          <Panel title={editingGoal ? "目標を編集" : "目標設定"} icon={Target}>
            <GoalForm dreams={linkableDreams} goal={editingGoal} onSubmit={saveGoal} onCancel={() => setEditingGoalId(null)} />
          </Panel>
          <Panel title="目標一覧" icon={CalendarDays}>
            {activeGoals.length === 0 ? (
              <Empty text="夢を10年、3年、1年、今月、今日の行動へ分解します。" />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {activeGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    dream={dreamById(goal.dream_id)}
                    onEdit={() => setEditingGoalId(goal.id)}
                    onArchive={() => void archiveGoal(goal)}
                  />
                ))}
              </div>
            )}
          </Panel>
        </section>
      )}

      {tab === "tasks" && (
        <section className="space-y-4">
          <Panel title={editingTask ? "タスクを編集" : "タスク入力"} icon={Plus}>
            <TaskForm
              dreams={linkableDreams}
              goals={activeGoals}
              task={editingTask}
              onSubmit={saveTask}
              onCancel={() => setEditingTaskId(null)}
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
            />
          </Panel>
        </section>
      )}

      {tab === "inbox" && (
        <section className="space-y-4">
          <Panel title={editingInboxItem ? "メモ・気づきを編集" : "メモ・気づき"} icon={Inbox}>
            <InboxForm item={editingInboxItem} onSubmit={saveInboxItem} onCancel={() => setEditingInboxId(null)} />
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
            <ReflectionForm reflection={todayReflection} onSubmit={saveReflection} />
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
                onClick={() => setTab(item.key)}
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
      <button className="rounded-md p-1" onClick={onClose} aria-label="通知を閉じる">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/80 bg-white/88 p-4 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-lg bg-mist p-2 text-moss">
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
  onArchive
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
              <span className="rounded-full bg-mist px-2 py-1 text-xs font-bold text-moss">{matrixLabel(task)}</span>
              <span className={`rounded-full px-2 py-1 text-xs font-bold ${dateDistance(task.due_date) <= 3 ? "bg-dawn/20 text-clay" : "bg-mist text-moss"}`}>
                {dueLabel(task.due_date)}
              </span>
              {recommendation && <span className="rounded-full bg-ink px-2 py-1 text-xs font-bold text-white">{recommendation.priority_label}</span>}
            </div>
            <h3 className={`${prominent ? "text-lg" : "text-base"} mt-2 font-bold text-ink`}>{task.title}</h3>
            {recommendation?.reason && <p className="mt-1 text-sm leading-6 text-ink/70">{recommendation.reason}</p>}
            {(dream || goal) && (
              <p className="mt-2 text-xs leading-5 text-moss">
                {goal?.title ?? "目標未紐づけ"}
                {dream ? ` / ${dream.title}` : ""}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="mini-button" onClick={() => onEdit(task)}>
                <Edit3 className="h-3.5 w-3.5" /> 編集
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
      <Field label="カテゴリー">
        <select name="category" defaultValue={dream?.category ?? "その他"} className="input">
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </Field>
      <Field label="夢">
        <input name="title" required defaultValue={dream?.title} placeholder="例：1年後に起業する" className="input" />
      </Field>
      <Field label="内容" hint="なぜ実現したいか、どんな状態になりたいかを短く書きます。">
        <textarea name="reason" rows={3} defaultValue={dream?.reason} placeholder="例：自分の強みを活かして、家族との時間も大切にできる働き方にしたい" className="input" />
      </Field>
      <Field label="期限">
        <DeadlineInput name="deadline" defaultValue={dream?.deadline} />
      </Field>
      <Field label="達成したい状態">
        <textarea name="desired_state" rows={3} defaultValue={dream?.desired_state} placeholder="例：最初の商品を販売し、継続して収益が出始めている" className="input" />
      </Field>
      <FormActions editing={Boolean(dream)} saveLabel={dream ? "夢を更新" : "夢を保存"} onCancel={onCancel} />
    </form>
  );
}

function DreamCard({
  dream,
  goals,
  tasks,
  onStatus,
  onEdit,
  onArchive,
  onClarify,
  aiLoading
}: {
  dream: Dream;
  goals: Goal[];
  tasks: Task[];
  onStatus: (status: Dream["status"]) => void;
  onEdit: () => void;
  onArchive: () => void;
  onClarify: () => void;
  aiLoading: boolean;
}) {
  return (
    <article className="rounded-lg border border-mist bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-clay">{dream.category || "その他"}</p>
          <h3 className="mt-1 text-lg font-bold text-ink">{dream.title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-mist px-2 py-1 text-xs font-semibold text-moss">{dream.deadline || "期限未設定"}</span>
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
                        {Object.entries(goalLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
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
  goal,
  onSubmit,
  onCancel
}: {
  dreams: Dream[];
  goal?: Goal;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form key={goal?.id ?? "new-goal"} onSubmit={onSubmit} className="space-y-4">
      <Field label="対象の夢">
        <select name="dream_id" defaultValue={goal?.dream_id ?? ""} className="input">
          <option value="">未紐づけ</option>
          {dreams.map((dream) => (
            <option key={dream.id} value={dream.id}>
              {dream.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="目標タイトル">
        <input name="title" required defaultValue={goal?.title} placeholder="例：事業アイデアを3つ検証する" className="input" />
      </Field>
      <Field label="説明">
        <textarea name="description" rows={3} defaultValue={goal?.description} className="input" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="目標の位置づけ" hint="夢から逆算して、いつ達成したい目標かを選びます。迷ったら今月目標でOKです。">
          <select name="level" defaultValue={goal?.level ?? "monthly"} className="input">
            {Object.entries(goalLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="目標の期限" hint="この目標をいつまでに終わらせるか。夢の期限より手前の日付にします。">
          <DeadlineInput name="deadline" defaultValue={goal?.deadline} />
        </Field>
      </div>
      <FormActions editing={Boolean(goal)} saveLabel={goal ? "目標を更新" : "目標を保存"} onCancel={onCancel} />
    </form>
  );
}

function GoalCard({
  goal,
  dream,
  onEdit,
  onArchive
}: {
  goal: Goal;
  dream?: Dream;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <article className="rounded-lg border border-mist bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-clay">{goalLabels[goal.level]}</p>
          <h3 className="mt-1 font-bold text-ink">{goal.title}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-mist px-2 py-1 text-xs font-semibold text-moss">{goal.deadline || "期限未設定"}</span>
      </div>
      {goal.description && <p className="mt-2 text-sm leading-6 text-ink/70">{goal.description}</p>}
      <p className="mt-3 text-xs text-moss">夢：{dream?.title ?? "未紐づけ"}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="mini-button" onClick={onEdit}>
          <Edit3 className="h-3.5 w-3.5" /> 編集
        </button>
        <button className="mini-button" onClick={onArchive}>
          <Archive className="h-3.5 w-3.5" /> アーカイブ
        </button>
      </div>
    </article>
  );
}

function TaskForm({
  dreams,
  goals,
  task,
  onSubmit,
  onCancel
}: {
  dreams: Dream[];
  goals: Goal[];
  task?: Task;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const [selectedDreamId, setSelectedDreamId] = useState(task?.dream_id ?? "");
  useEffect(() => setSelectedDreamId(task?.dream_id ?? ""), [task?.id, task?.dream_id]);
  const availableGoals = goals.filter((goal) => !selectedDreamId || !goal.dream_id || goal.dream_id === selectedDreamId);
  const selectedGoalIsValid = task?.goal_id && availableGoals.some((goal) => goal.id === task.goal_id);

  return (
    <form key={task?.id ?? "new-task"} onSubmit={onSubmit} className="space-y-4">
      <Field label="タスク名">
        <input name="title" required defaultValue={task?.title} placeholder="例：起業計画のメモを書く" className="input" />
      </Field>
      <Field label="メモ">
        <textarea name="memo" rows={3} defaultValue={task?.memo} className="input" />
      </Field>
      <Field label="期限">
        <TaskDueDateInput defaultValue={task?.due_date} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <label className="toggle">
          <input name="urgent" type="checkbox" defaultChecked={task?.urgent ?? false} />
          <span>緊急</span>
        </label>
        <label className="toggle">
          <input name="important" type="checkbox" defaultChecked={task?.important ?? true} />
          <span>重要</span>
        </label>
      </div>
      <Field label="関連する夢">
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
        <select key={`${task?.id ?? "new"}-${selectedDreamId}`} name="goal_id" defaultValue={selectedGoalIsValid ? task?.goal_id ?? "" : ""} className="input">
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

function TaskCard({
  task,
  dream,
  goal,
  onComplete,
  onEdit,
  onArchive
}: {
  task: Task;
  dream?: Dream;
  goal?: Goal;
  onComplete: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
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
            <span className="rounded-full bg-mist px-2 py-1 text-xs font-bold text-moss">{matrixLabel(task)}</span>
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${dateDistance(task.due_date) <= 3 ? "bg-dawn/20 text-clay" : "bg-mist text-moss"}`}>
              {dueLabel(task.due_date)}
            </span>
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
  onArchive
}: {
  tasks: Task[];
  dreams: Dream[];
  goals: Goal[];
  onComplete: (task: Task) => Promise<void>;
  onEdit: (task: Task) => void;
  onArchive: (task: Task) => Promise<void>;
}) {
  const groups = [
    ["緊急かつ重要", tasks.filter((task) => task.urgent && task.important)],
    ["緊急ではないが重要", tasks.filter((task) => !task.urgent && task.important)],
    ["緊急だが重要ではない", tasks.filter((task) => task.urgent && !task.important)],
    ["緊急でも重要でもない", tasks.filter((task) => !task.urgent && !task.important)]
  ] as const;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map(([label, items]) => (
        <section key={label} className="rounded-lg bg-mist/55 p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-ink">{label}</h3>
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
  onSubmit
}: {
  reflection?: Reflection;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="今日できたこと">
        <textarea name="done_text" rows={3} defaultValue={reflection?.done_text} className="input" />
      </Field>
      <Field label="できなかったこと">
        <textarea name="not_done_text" rows={3} defaultValue={reflection?.not_done_text} className="input" />
      </Field>
      <Field label="夢に近づいた行動">
        <textarea name="dream_progress_text" rows={3} defaultValue={reflection?.dream_progress_text} className="input" />
      </Field>
      <Field label="明日やること">
        <textarea name="tomorrow_text" rows={3} defaultValue={reflection?.tomorrow_text} className="input" />
      </Field>
      <Field label="気づき">
        <textarea name="insight_text" rows={3} defaultValue={reflection?.insight_text} className="input" />
      </Field>
      <Field label="満足度">
        <input
          name="satisfaction_score"
          type="range"
          min="1"
          max="5"
          defaultValue={reflection?.satisfaction_score ?? 3}
          className="w-full accent-clay"
        />
      </Field>
      <button type="submit" className="primary-button">
        振り返りを保存
      </button>
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
