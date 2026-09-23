"use client";

import { useEffect } from "react";

export function DisableNumberWheel() {
  useEffect(() => {
    function onWheel(event: WheelEvent) {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== "number") return;
      event.preventDefault();
    }

    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);

  return null;
}
