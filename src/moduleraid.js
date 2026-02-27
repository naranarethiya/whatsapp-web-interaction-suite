/* moduleRaid v5
 * https://github.com/@pedroslopez/moduleRaid
 *
 * Copyright pixeldesu, pedroslopez and other contributors
 * Licensed under the MIT License
 * https://github.com/pedroslopez/moduleRaid/blob/master/LICENSE
 */

const moduleRaid = function () {
  moduleRaid.mID  = Math.random().toString(36).substring(7);
  moduleRaid.mObj = {};

  fillModuleArray = function() {
    if (parseFloat(window?.Debug?.VERSION) < 2.3) {
      (window.webpackChunkbuild || window.webpackChunkwhatsapp_web_client).push([
        [moduleRaid.mID], {}, function(e) {
          Object.keys(e.m).forEach(function(mod) {
            moduleRaid.mObj[mod] = e(mod);
          })
        }
      ]);
    } else {
      let modules = self.require('__debug').modulesMap;
      Object.keys(modules).filter(e => e.includes("WA")).forEach(function (mod) {
          let modulos = modules[mod];
          if (modulos) {
            moduleRaid.mObj[mod] = {
                  default: modulos.defaultExport,
                  factory: modulos.factory,
                  ...modulos
              };
              if (Object.keys(moduleRaid.mObj[mod].default).length == 0) {
                  try {
                      self.ErrorGuard.skipGuardGlobal(true);
                      Object.assign(moduleRaid.mObj[mod], self.importNamespace(mod));
                  } catch (e) {
                  }
              }
          }
      })
    }
  }

  try {
    fillModuleArray();
  } catch (e) {
    console.warn('[moduleRaid] Initial load failed, will retry:', e.message);
  }

  get = function get (id) {
    return moduleRaid.mObj[id]
  }

  findModule = function findModule (query) {
    results = [];
    modules = Object.keys(moduleRaid.mObj);

    modules.forEach(function(mKey) {
      mod = moduleRaid.mObj[mKey];

      if (typeof mod !== 'undefined') {
        if (typeof query === 'string') {
          if (typeof mod.default === 'object') {
            for (key in mod.default) {
              if (key == query) results.push(mod);
            }
          }

          for (key in mod) {
            if (key == query) results.push(mod);
          }
        } else if (typeof query === 'function') { 
          if (query(mod)) {
            results.push(mod);
          }
        } else {
          throw new TypeError('findModule can only find via string and function, ' + (typeof query) + ' was passed');
        }
        
      }
    })

    return results;
  }

  return {
    modules: moduleRaid.mObj,
    constructors: moduleRaid.cArr,
    findModule: findModule,
    get: get
  }
}

/**
 * Retry wrapper: WhatsApp's webpack modules may not be available at document_idle.
 * Retries up to 10 times (every 2s) before giving up.
 */
function initModuleRaid(attempt) {
  attempt = attempt || 1;
  var maxAttempts = 10;
  try {
    window.mR = moduleRaid();
    if (Object.keys(moduleRaid.mObj).length === 0) {
      throw new Error('No modules found');
    }
    console.log('[moduleRaid] Loaded ' + Object.keys(moduleRaid.mObj).length + ' modules (attempt ' + attempt + ')');
  } catch (e) {
    if (attempt < maxAttempts) {
      console.warn('[moduleRaid] Attempt ' + attempt + '/' + maxAttempts + ' failed (' + e.message + '), retrying in 2s...');
      setTimeout(function() { initModuleRaid(attempt + 1); }, 2000);
    } else {
      console.error('[moduleRaid] Failed after ' + maxAttempts + ' attempts. WhatsApp modules unavailable.');
    }
  }
}

if (typeof module === 'object' && module.exports) {
  module.exports = moduleRaid;
} else {
  initModuleRaid(1);
}