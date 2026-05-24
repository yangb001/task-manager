import { create } from 'zustand';
import type { Task, TaskFilter } from '../../shared/types';

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
      throw err;
    }
  },

  setFilter: (filter) => {
    set({ filter });
    get().fetchTasks(filter);
  },

  createTask: async (data) => {
    const task = await window.taskManager.tasks.create(data);
    set(state => ({ tasks: [task, ...state.tasks] }));
    return task;
  },

  updateTask: async (id, data) => {
    const updated = await window.taskManager.tasks.update(id, data);
    set(state => ({
      tasks: state.tasks.map(t => t.id === id ? (updated || { ...t, ...data }) : t),
    }));
  },

  deleteTask: async (id) => {
    const prev = get().tasks;
    set(state => ({ tasks: state.tasks.filter(t => t.id !== id) }));
    try {
      await window.taskManager.tasks.delete(id);
    } catch (err) {
      set({ tasks: prev });
      throw err;
    }
  },

  startTask: async (id) => {
    set(state => ({
      tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'running' } : t),
    }));
    try {
      await window.taskManager.control.start(id);
    } catch (err) {
      set(state => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'idle' } : t),
      }));
      throw err;
    }
  },

  pauseTask: async (id) => {
    set(state => ({
      tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'paused' } : t),
    }));
    try {
      await window.taskManager.control.pause(id);
    } catch (err) {
      set(state => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'running' } : t),
      }));
      throw err;
    }
  },

  resumeTask: async (id) => {
    set(state => ({
      tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'idle' } : t),
    }));
    try {
      await window.taskManager.control.resume(id);
    } catch (err) {
      set(state => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, status: 'paused' } : t),
      }));
      throw err;
    }
  },
}));
