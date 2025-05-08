const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    babel: {
      dangerouslyAddModulePathsToTranspile: ['@expo/vector-icons']
    }
  }, argv);

  // Log the environment variables being used
  console.log('Webpack environment variables:', {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? 'Present' : 'Missing',
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ? 'Present' : 'Missing'
  });

  return config;
}; 