import { getStore } from './store-provider.js';
import { runOnce, startLoop } from './worker.js';

const main = async (): Promise<void> => {
	const mode = process.argv[2] ?? 'loop';
	const store = getStore();

	if (mode === 'once') {
		await runOnce({ store });
		return;
	}

	startLoop({
		store,
		intervalMs: Number(process.env.WORKER_INTERVAL_MS ?? 1000),
	});
};

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
