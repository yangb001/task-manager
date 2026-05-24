export { PluginManager, pluginManager } from './plugin-manager';
export { PluginScanner, pluginScanner } from './plugin-scanner';
export type {
  PluginContext,
  PluginLogger,
  TriggerPlugin,
  TriggerContext,
  TriggerData,
  ActionPlugin,
  ActionContext,
  ActionResult,
  VariableScope,
} from './plugin-types';
export { isTriggerPlugin, isActionPlugin } from './plugin-types';