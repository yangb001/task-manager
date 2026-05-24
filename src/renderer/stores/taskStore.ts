import { create } from 'zustand';
import type { Task, TaskFilter } from '../../shared/types';

// 声明 preload 暴露的 API
declare global {
  interface Window {
    taskManager: any;
  }
}

interface TaskStore {
  tasks: Task[];
  loading: boolean;
  filter: TaskFilter;

  fetchTasks: (filter?: TaskFilter) => Promise<void>;
  setFilter: (filter: TaskFilter) => void;
  createTask: (data: any) => Promise<Task>;
  updateTask: (id: string, data: any) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  startTask: (id: string) => Promise<void>;
  pauseTask: (id: string) => Promise<void>;
  resumeTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  filter: {},

  fetchTasks: async (filter?: TaskFilter) => {
    set({ loading: true });
    try {
      const tasks = await window.taskManager.tasks.list(filter || get().filter);
      set({ tasks, loading: false });
    } catch (err) {
      console.error('获取任务列表失败', err);
      set({ loading: false });
    }
  },

  setFilter: (filter) => {
    set({ filter });
    get().fetchTasks(filter);
  },

  createTask: async (data) => {
    const task = await window.taskManager.tasks.create(data);
    await get().fetchTasks();
    return task;
  },

  updateTask: async (id, data) => {
    await window.taskManager.tasks.update(id, data);
    await get().fetchTasks();
  },

  deleteTask: async (id) => {
    await window.taskManager.tasks.delete(id);
    await get().fetchTasks();
  },

  startTask: async (id) => {
    await window.taskManager.control.start(id);
    await get().fetchTasks();
  },

  pauseTask: async (id) => {
    await window.taskManager.control.pause(id);
    await get().fetchTasks();
  },

  resumeTask: async (id) => {
    await window.taskManager.control.resume(id);
    await get().fetchTasks();
  },
}));