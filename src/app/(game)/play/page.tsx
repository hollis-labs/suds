"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TerminalLoading } from "@/components/terminal";

export default function PlayPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/characters");
  }, [router]);

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <TerminalLoading />
    </div>
  );
}
