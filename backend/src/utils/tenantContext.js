const { AsyncLocalStorage } = require('async_hooks');

const tenantStorage = new AsyncLocalStorage();

module.exports = {
  tenantStorage,
  getCompanyId: () => tenantStorage.getStore(),
  runWithCompanyId: (companyId, callback) => {
    return tenantStorage.run(companyId, callback);
  }
};
