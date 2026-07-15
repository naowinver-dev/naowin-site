import { CaptureFlow } from "./capture-flow";

export default async function CapturePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CaptureFlow token={token} />;
}
