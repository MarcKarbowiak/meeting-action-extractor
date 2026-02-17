import { getStore } from './store-provider.js';
import { runOnce, startLoop } from './worker.js';
import { getFlag, initTelemetry, parseEnvFlags } from '@meeting-action-extractor/shared';

const main = async (): Promise<void> => {
	const envFlags = parseEnvFlags();
	const telemetryEnabled = getFlag('telemetry.enabled', {
		environment: process.env.NODE_ENV ?? 'local',
		envFlags,
	}) === true;

	if (telemetryEnabled) {
		await initTelemetry({ serviceName: 'worker' });
	}

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
