const path = require('path');
const config = require('expo/config');
const resolveFrom = require('resolve-from');
const fs = require('fs');
const extensions = require('./node_modules/@expo/webpack-config/webpack/env/extensions');
const projectRoot = path.resolve('frontend');
function getFileWithExtensions(projectRoot, fileName, extensions) {
  for (const extension of extensions) {
    const filePath = path.resolve(projectRoot, `${fileName}.${extension}`);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}
function resolveFromSilentWithExtensions(fromDirectory, moduleId, extensions) {
  for (const extension of extensions) {
    const modulePath = resolveFrom.silent(fromDirectory, `${moduleId}.${extension}`);
    if (modulePath) return modulePath;
  }
  return null;
}
function getEntryPointWithExtensions(projectRoot, entryFiles, extensions) {
  const pkg = config.getPackageJson(projectRoot);
  if (pkg) {
    const main = pkg.main;
    if (main && typeof main === 'string') {
      let entry = getFileWithExtensions(projectRoot, main, extensions);
      if (!entry) {
        entry = resolveFromSilentWithExtensions(projectRoot, main, extensions);
        if (!entry) throw new Error('Cannot resolve entry file');
      }
      return entry;
    }
  }
  for (const fileName of entryFiles) {
    const entry = resolveFromSilentWithExtensions(projectRoot, fileName, extensions);
    if (entry) return entry;
  }
  try {
    return resolveFrom(projectRoot, 'expo/AppEntry');
  } catch (e) {
    throw e;
  }
}
console.log(getEntryPointWithExtensions(projectRoot, ['./index', './src/index'], extensions.getBareExtensions(['web'])));
