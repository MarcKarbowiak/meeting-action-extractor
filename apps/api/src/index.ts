import { buildApiApp } from './app.js';
import { getFlag, initTelemetry, parseEnvFlags } from '@meeting-action-extractor/shared';

const start = async (): Promise<void> => {
	const envFlags = parseEnvFlags();
	const telemetryEnabled = getFlag('telemetry.enabled', {
		environment: process.env.NODE_ENV ?? 'local',
		envFlags,
	}) === true;

	if (telemetryEnabled) {
		await initTelemetry({ serviceName: 'api' });
	}

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
