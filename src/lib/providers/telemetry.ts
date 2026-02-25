import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeSDK } from '@opentelemetry/sdk-node';

// ── OpenTelemetry + Langfuse v4 Init ────────────────────────────────────────
// Lazy singleton: initialized once on first LLM call.
// Langfuse v4 uses OTel spans — all traces export via LangfuseSpanProcessor.
//
// Env vars: LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASEURL

let initialized = false;
let sdk: NodeSDK | null = null;

/**
 * Initialize the OpenTelemetry SDK with Langfuse span processor.
 * Safe to call multiple times — only initializes once.
 *
 * Returns false if Langfuse env vars are not configured (tracing disabled).
 */
export function initTelemetry(): boolean {
  if (initialized) return sdk !== null;

  initialized = true;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASEURL;

  if (!publicKey || !secretKey) {
    console.warn(
      '[telemetry] LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY not set — tracing disabled',
    );
    return false;
  }

  sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        ...(baseUrl ? { baseUrl } : {}),
        environment: process.env.NODE_ENV ?? 'development',
      }),
    ],
  });

  sdk.start();
  return true;
}

/**
 * Gracefully shut down the OTel SDK (flushes pending spans to Langfuse).
 * Call on server shutdown / process exit.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    initialized = false;
  }
}
