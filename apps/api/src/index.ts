import { buildApiApp } from './app.js';

const start = async (): Promise<void> => {
	const app = buildApiApp();
	const port = Number(process.env.PORT ?? 3000);
	const host = process.env.HOST ?? '0.0.0.0';

	await app.listen({
		port,
		host,
	});
};

start().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
