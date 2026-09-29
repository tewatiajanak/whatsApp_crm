import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Search, Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "outline" | "ghost" | "danger";
type ButtonSize = "md" | "sm" | "icon" | "icon-sm";

interface UIButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * Shared button used across the whole app. Always 40px tall (32px for
 * size="sm"), 10px radius, DM Sans, consistent hover, disabled and focus
 * states. Backed by `.ui-btn` CSS in styles.css so old bootstrap pages
 * can adopt it too.
 */
export const UIButton = forwardRef<HTMLButtonElement, UIButtonProps>(
  (
    { variant = "primary", size = "md", loading, leftIcon, rightIcon, className, children, disabled, ...rest },
    ref
  ) => {
    const cls = [
      "ui-btn",
      variant === "primary" && "ui-btn-primary",
      variant === "outline" && "ui-btn-outline",
      variant === "ghost" && "ui-btn-ghost",
      variant === "danger" && "ui-btn-danger",
      (size === "sm" || size === "icon-sm") && "ui-btn-sm",
      (size === "icon" || size === "icon-sm") && "ui-btn-icon",
      className,
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
        {size !== "icon" && size !== "icon-sm" && children}
        {rightIcon}
      </button>
    );
  }
);
UIButton.displayName = "UIButton";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

/**
 * Shared search input used across the whole app. Icon on the left inside a
 * 40px-tall bordered pill container with consistent focus ring. Fills its
 * parent width by default; override with containerClassName for max-width
 * or fixed width.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ containerClassName, placeholder = "Search…", ...rest }, ref) => {
    return (
      <div className={`ui-search ${containerClassName ?? ""}`}>
        <span className="ui-search-icon">
          <Search className="h-4 w-4" />
        </span>
        <input ref={ref} type="text" className="ui-search-input" placeholder={placeholder} {...rest} />
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

interface UIInputProps extends InputHTMLAttributes<HTMLInputElement> {}
/** Standard 40px text input matching the SearchInput height/radius. */
export const UIInput = forwardRef<HTMLInputElement, UIInputProps>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={`ui-input ${className ?? ""}`} {...rest} />
  )
);
UIInput.displayName = "UIInput";
