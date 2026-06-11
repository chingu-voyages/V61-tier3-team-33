const config = {
	port: Number(Bun.env.PORT ?? 3001),
	clientUrl: Bun.env.CLIENT_URL ?? "http://localhost:5173",
	nodeEnv: Bun.env.NODE_ENV ?? "development",
} as const;

export default config;
