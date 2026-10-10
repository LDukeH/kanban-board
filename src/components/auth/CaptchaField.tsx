import HCaptcha from "@hcaptcha/react-hcaptcha";
import { forwardRef } from "react";

interface CaptchaFieldProps {
  onTokenChange: (token: string) => void;
}

const siteKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY;

const CaptchaField = forwardRef<HCaptcha, CaptchaFieldProps>(
  function CaptchaField({ onTokenChange }, ref) {
    if (!siteKey) {
      return (
        <p role="alert" className="text-sm text-destructive">
          hCaptcha is not configured. Set VITE_HCAPTCHA_SITE_KEY to continue.
        </p>
      );
    }

    return (
      <HCaptcha
        ref={ref}
        sitekey={siteKey}
        onVerify={onTokenChange}
        onExpire={() => onTokenChange("")}
        onChalExpired={() => onTokenChange("")}
        onError={() => onTokenChange("")}
      />
    );
  },
);

export default CaptchaField;
