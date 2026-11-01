"use client";
import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn("relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50", className)} {...props}>
      <SliderPrimitive.Track className="bg-muted relative h-2 w-full grow overflow-hidden rounded-full">
        <SliderPrimitive.Range className="bg-primary absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="border-primary bg-background block size-5 rounded-full border-2 shadow-sm focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-none" aria-label="値" />
    </SliderPrimitive.Root>
  );
}
export { Slider };
