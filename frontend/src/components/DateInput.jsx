import { useRef } from "react";

// Date field that always displays dd-mm-yyyy, regardless of browser locale.
// The value in/out stays ISO (yyyy-mm-dd), exactly like <input type="date">,
// and onChange receives the native change event — so it is a drop-in swap.
export default function DateInput({
  value,
  onChange,
  className = "",
  style,
  title,
  placeholder = "dd-mm-yyyy",
  wrapperClassName = "",
  wrapperStyle,
  disabled,
  ...rest
}) {
  const ref = useRef(null);
  const iso = value ? String(value).slice(0, 10) : "";
  const display = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("-") : "";

  const openPicker = () => {
    if (disabled) return;
    try {
      ref.current?.showPicker?.();
    } catch {
      ref.current?.focus();
    }
  };

  return (
    <span
      className={wrapperClassName}
      style={{ position: "relative", display: "block", ...wrapperStyle }}
    >
      <input
        type="text"
        readOnly
        tabIndex={-1}
        value={display}
        placeholder={placeholder}
        className={className}
        style={{ ...style, paddingRight: 30 }}
        title={title}
        disabled={disabled}
      />
      <i
        className="bi bi-calendar3"
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, opacity: 0.6, pointerEvents: "none" }}
      />
      <input
        ref={ref}
        type="date"
        value={iso}
        onChange={onChange}
        onClick={openPicker}
        disabled={disabled}
        aria-label={title || rest["aria-label"] || "Date"}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: disabled ? "not-allowed" : "pointer" }}
        {...rest}
      />
    </span>
  );
}
