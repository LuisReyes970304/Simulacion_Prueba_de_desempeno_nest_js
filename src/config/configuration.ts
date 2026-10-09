export default () => ({
  port: parseInt(process.env.PORT ?? '', 10) || 3000,
  apiKeys: (process.env.API_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0),
  database: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: parseInt(process.env.POSTGRES_PORT ?? '', 10) || 5432,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    name: process.env.POSTGRES_DB,
  },
});
