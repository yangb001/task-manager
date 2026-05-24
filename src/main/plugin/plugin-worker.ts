import { parentPort, workerData } from 'worker_threads';

interface WorkerMessage {
  type: 'execute';
  pluginEntry: string;
  config: Record<string, any>;
  context: any;
}

interface WorkerResult {
  type: 'result' | 'error';
  data?: any;
  error?: string;
}

async function loadAndExecute(entryPath: string, config: Record<string, any>, context: any): Promise<any> {
  const plugin = await import(entryPath);
  const PluginClass = plugin.default || plugin;
  const instance = new PluginClass();

  if (typeof instance.initialize === 'function') {
    await instance.initialize({ dataDir: '', logger: console });
  }

  if (typeof instance.execute === 'function') {
    return await instance.execute(config, context);
  }
  throw new Error('Plugin does not implement execute()');
}

parentPort?.on('message', async (msg: WorkerMessage) => {
  if (msg.type === 'execute') {
    try {
      const result = await loadAndExecute(msg.pluginEntry, msg.config, msg.context);
      parentPort?.postMessage({ type: 'result', data: result } as WorkerResult);
    } catch (err: any) {
      parentPort?.postMessage({ type: 'error', error: err.message } as WorkerResult);
    }
  }
});
