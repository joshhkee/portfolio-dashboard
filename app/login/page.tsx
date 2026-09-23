import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { USERNAME_RULE } from "@/lib/accounts";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export default function LoginPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Suspense fallback={null}>
        {/* The two rules are passed in rather than imported by the form, the
            same way the accounts page hands them to AccountManager: one
            definition, and the hint under a field cannot disagree with the
            validator that will answer it. */}
        <LoginForm usernameRule={USERNAME_RULE} minPasswordLength={MIN_PASSWORD_LENGTH} />
      </Suspense>
    </div>
  );
}
