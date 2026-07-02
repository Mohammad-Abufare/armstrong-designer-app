// Treat .html as a bundled asset so the designer can ship inside the app (loaded locally, offline).
const {getDefaultConfig} = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('html');

module.exports = config;
