const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Let Metro resolve the Drizzle .sql migration files.
config.resolver.sourceExts.push('sql');

module.exports = config;
