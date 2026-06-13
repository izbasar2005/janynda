import { forwardRef, useImperativeHandle, useRef } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from "../config/turnstile";

const TurnstileField = forwardRef(function TurnstileField({ onToken, onExpire }, ref) {
  const widgetRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reset() {
      widgetRef.current?.reset();
    },
  }));

  if (!TURNSTILE_ENABLED) return null;

  return (
    <div className="turnstile-field" style={{ margin: "8px 0 4px" }}>
      <Turnstile
        ref={widgetRef}
        siteKey={TURNSTILE_SITE_KEY}
        onSuccess={(token) => onToken?.(token)}
        onExpire={() => {
          onToken?.("");
          onExpire?.();
        }}
        onError={() => onToken?.("")}
        options={{ theme: "light", size: "flexible" }}
      />
    </div>
  );
});

export default TurnstileField;
