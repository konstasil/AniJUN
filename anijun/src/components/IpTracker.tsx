"use client";
import { useEffect } from "react";

export default function IpTracker() {
  useEffect(() => {
    fetch("/api/track-ip", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
