const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Customize the config before returning it.
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve.alias,
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native-web'),
      'react-native-web': path.resolve(__dirname, 'node_modules/react-native-web'),
    },
    extensions: ['.web.js', '.js', '.web.tsx', '.tsx', '.web.ts', '.ts', '.web.jsx', '.jsx', '.json'],
  };

  // Add web-specific rules
  config.module.rules.push({
    test: /\.(js|jsx|ts|tsx)$/,
    exclude: /node_modules\/(?!(react-native|@react-native|react-native-web|@expo|expo-router)\/).*/,
    use: {
      loader: 'babel-loader',
      options: {
        presets: ['babel-preset-expo'],
        plugins: ['nativewind/babel'],
      },
    },
  });

  // Ensure proper module resolution
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "path": require.resolve("path-browserify"),
    "fs": false,
    "crypto": false
  };

  return config;
}; 