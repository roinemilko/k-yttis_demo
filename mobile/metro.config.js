const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Laitteet, pohjapiirrokset ja skenaariot luetaan samoista JSON-tiedostoista kuin backendissä.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../shared')];

module.exports = config;
