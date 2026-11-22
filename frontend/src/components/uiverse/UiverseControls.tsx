import React from "react";

interface PushButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "cyan" | "amber" | "rose" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "px-3.5 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

export const PushButton: React.FC<PushButtonProps> = ({
  variant = "cyan",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  ...rest
}) => {
  return (
    <button
      {...rest}
      className={`ui-push-btn ui-push-btn--${variant} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      <span className="ui-push-btn__shadow" aria-hidden="true" />
      <span className="ui-push-btn__edge" aria-hidden="true" />
      <span className={`ui-push-btn__front ${SIZE_CLASSES[size]}`}>{children}</span>
    </button>
  );
};

interface GlowToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export const GlowToggle: React.FC<GlowToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}) => {
  return (
    <div className="flex items-center justify-between gap-3">
      {(label || description) && (
        <div className="min-w-0">
          {label && <div className="text-sm font-medium text-slate-100">{label}</div>}
          {description && <div className="text-xs text-slate-400 mt-0.5">{description}</div>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        data-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className="ui-toggle shrink-0"
      >
        <span className="ui-toggle__thumb" />
      </button>
    </div>
  );
};

interface TactileCardProps {
  className?: string;
  children: React.ReactNode;
}

export const TactileCard: React.FC<TactileCardProps> = ({ className = "", children }) => {
  return <div className={`ui-glass-card ${className}`}>{children}</div>;
};

interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

interface SegmentedControlProps<T extends string | number> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div
      className={`inline-flex flex-wrap gap-1.5 rounded-2xl bg-slate-950/75 p-1.5 border border-slate-800/80 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer ${
              active
                ? "bg-gradient-to-br from-cyan-400/25 via-sky-500/20 to-cyan-600/25 text-cyan-200 border border-cyan-400/50 shadow-[0_0_16px_-4px_rgba(34,211,238,0.5)]"
                : "text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <div>{opt.label}</div>
            {opt.hint && (
              <div className={`text-[10px] font-normal mt-0.5 ${active ? "text-cyan-300/80" : "text-slate-500"}`}>
                {opt.hint}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
