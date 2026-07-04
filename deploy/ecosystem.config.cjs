/**
 * PM2 配置文件
 * 使用 tsx 直接运行 TypeScript，无需编译
 */
module.exports = {
    apps: [
        {
            name: 'wrap-server',
            script: 'npx',
            args: 'tsx src/index.ts',
            cwd: './',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production',
            },
            // 日志配置
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: './logs/error.log',
            out_file: './logs/output.log',
            merge_logs: true,
        },
    ],
}
