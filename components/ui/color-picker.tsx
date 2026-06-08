import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Input } from "./input";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#000000", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB", "#F3F4F6", "#FFFFFF",
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#3B82F6", "#8B5CF6",
  "#EC4899", "#F43F5E", "#FB923C", "#FACC15", "#4ADE80", "#2DD4BF", "#60A5FA",
  "#A78BFA", "#F472B6", "#BE123C", "#C2410C", "#A16207", "#15803D", "#0F766E",
  "#1D4ED8", "#6D28D9", "#BE185D",
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
  triggerClassName?: string;
}

export function ColorPicker({ value, onChange, className, triggerClassName }: ColorPickerProps) {
  const [hexInput, setHexInput] = React.useState(value);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setHexInput(value);
  }, [value]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setHexInput(newValue);
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(newValue);
    }
  };

  const handlePresetClick = (color: string) => {
    onChange(color);
    setHexInput(color);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "rounded border border-border cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
            triggerClassName
          )}
          style={{ backgroundColor: value }}
          aria-label="Pick color"
        />
      </PopoverTrigger>
      <PopoverContent className={cn("w-[220px] p-3", className)} align="end">
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                className={cn(
                  "w-6 h-6 rounded-sm border cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring",
                  color === value ? "ring-2 ring-primary ring-offset-1" : "border-border"
                )}
                style={{ backgroundColor: color }}
                onClick={() => handlePresetClick(color)}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded border border-border shrink-0"
              style={{ backgroundColor: value }}
            />
            <Input
              value={hexInput}
              onChange={handleHexChange}
              placeholder="#000000"
              className="h-8 text-xs font-mono"
              maxLength={7}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
