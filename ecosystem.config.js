module.exports = {
    apps: [
      {
        name: 'everest-app',
        script: 'npm',
        args: 'start',
        interpreter: 'none',
        cwd: 'D:\WebEverest\everest-app',
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
          NODE_ENV: 'production'
        }
      }
    ]
  };
  