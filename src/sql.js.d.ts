declare module 'sql.js' {
    interface SqlJsStatic {
        Database: new (data?: ArrayLike<number> | Buffer | null) => Database
    }

    interface Database {
        run(sql: string, params?: any[]): Database
        exec(sql: string, params?: any[]): QueryExecResult[]
        close(): void
        export(): Uint8Array
    }

    interface QueryExecResult {
        columns: string[]
        values: any[][]
    }

    export { Database, QueryExecResult }
    export default function initSqlJs(): Promise<SqlJsStatic>
}
