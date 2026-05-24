declare module 'sql.js' {
  interface SqlJsStatic {
    (config?: SqlJsConfig): Promise<Database>;
  }

  interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  interface Statement {
    bind(params?: any[]): boolean;
    step(): boolean;
    getAsObject(params?: object): Record<string, any>;
    free(): boolean;
    reset(): void;
  }

  interface Database {
    run(sql: string, params?: any[]): Database;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export type { Database, Statement, SqlJsStatic, SqlJsConfig, QueryExecResult };
  export default function initSqlJs(config?: SqlJsConfig): Promise<Database>;
}