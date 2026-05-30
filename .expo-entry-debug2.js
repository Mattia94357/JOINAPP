const path = require('path');
const config = require('expo/config');
const resolveFrom = require('resolve-from');
const fs = require('fs');
const projectRoot = path.resolve('frontend');
const pkg = config.getPackageJson(projectRoot);
console.log('pkg.main=', pkg.main);
const mainPath = path.resolve(projectRoot, pkg.main);
console.log('mainPath exists', fs.existsSync(mainPath), mainPath);
console.log('resolveFrom silent main', resolveFrom.silent(projectRoot, pkg.main));
console.log('expoEntry', resolveFrom.silent(projectRoot, 'expo/AppEntry'));
console.log('index.web', resolveFrom.silent(projectRoot, './index.web'));
console.log('src/index.web', resolveFrom.silent(projectRoot, './src/index.web'));
function tryResolveMain(){
  const main = pkg.main;
  let entry = null;
  if (fs.existsSync(path.resolve(projectRoot, main))) {
    entry = path.resolve(projectRoot, main);
  }
  if (!entry) {
    for (const extension of ['web']) {
      const modulePath = resolveFrom.silent(projectRoot, `${main}.${extension}`);
      if (modulePath) entry = modulePath;
    }
  }
  return entry;
}
try {
  console.log('tryResolveMain', tryResolveMain());
} catch (e) {
  console.error('tryResolveMain error', e.message);
}
try {
  console.log('expoFallback', resolveFrom(projectRoot, 'expo/AppEntry'));
} catch (e) {
  console.error('expoFallback error', e.message);
}
