/**
 * @fileoverview PM2 Ecosystem Configuration for Production Clustering.
 * Configures instances to use maximum CPU cores, run in cluster mode,
 * and format JSON logs ready for Loki/Promtail aggregation.
 */

module.exports = {
  apps: [
    {
      name: 'hrms-backend',
      script: 'src/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        LOG_LEVEL: 'info'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Disable PM2 internal files to write straight to stdout/stderr.
      // Structured JSON logs from stdout are captured by log shippers (Promtail)
      // and sent directly to Grafana Loki.
      out_file: '/dev/null',
      error_file: '/dev/null',
      merge_logs: true
    }
  ]
};
