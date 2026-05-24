declare module 'sql.js' {
  interface SqlJsStatic {
    (config?: SqlJsConfig): Promise<SqlJsDatabase>;
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

  interface SqlJsDatabase {
    run(sql: string, params?: any[]): SqlJsDatabase;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export type { SqlJsDatabase, Statement, SqlJsStatic, SqlJsConfig, QueryExecResult };
  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsDatabase>;
}