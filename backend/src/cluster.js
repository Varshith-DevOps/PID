/**
 * @fileoverview Node.js Process Clustering & Load Balancer Router.
 * Spawns worker processes matching the system's available CPU cores.
 * Dynamically routes incoming connections and auto-restarts dead worker threads.
 * @module cluster
 */

const cluster = require('cluster');
const os = require('os');
const path = require('path');

// Determine the number of CPU cores available on the server
const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`🚀 Master Process [PID: ${process.pid}] is running.`);
  console.log(`⚙️ Spawning load balancer across ${numCPUs} worker threads...`);

  // Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Monitor worker threads status
  cluster.on('exit', (worker, code, signal) => {
    console.error(`⚠️ Worker Process [PID: ${worker.process.pid}] terminated (Signal: ${signal || 'none'}, Code: ${code}).`);
    console.log('🔄 Spawning a replacement worker process to maintain capacity...');
    cluster.fork();
  });

} else {
  // Worker processes run the Express application
  console.log(`✓ Worker Process [PID: ${process.pid}] started successfully.`);
  require('./index.js');
}
