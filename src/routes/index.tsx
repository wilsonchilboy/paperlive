import { createFileRoute } from "@tanstack/react-router";
import { TapeApp } from "@/components/tape-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <TapeApp />;
}
