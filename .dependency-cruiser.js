module.exports = {
  forbidden: [
    {
      name: 'no-cross-module-imports',
      comment: 'Modules must remain isolated. Communication only via Events or Reference data.',
      severity: 'error',
      from: { path: 'src/modules/([^/]+)/.+' },
      to: { 
        path: 'src/modules/([^/]+)/.+',
        pathNot: 'src/modules/$1/.+' 
      }
    }
  ]
};