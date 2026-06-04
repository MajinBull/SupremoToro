import { useAuth } from "../auth/AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";

export default function AuthBar() {
  const { t } = useI18n();
  const {
    user,
    loading,
    configured,
    signInWithGoogle,
    signOut,
    lastError,
  } = useAuth();

  async function handleSignIn() {
    try {
      await signInWithGoogle();
    } catch {
      /* errore già in context o popup chiuso */
    }
  }

  if (!configured) {
    return null;
  }

  if (loading) {
    return (
      <div className="auth-bar" aria-live="polite">
        <span className="auth-bar__loading">{t("auth.loading")}</span>
      </div>
    );
  }

  if (user) {
    const label =
      user.displayName?.trim() ||
      user.email?.split("@")[0] ||
      "Account";
    return (
      <div className="auth-bar">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="auth-bar__avatar"
            width={28}
            height={28}
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span className="auth-bar__name" title={user.email ?? ""}>
          {label}
        </span>
        <button
          type="button"
          className="auth-bar__btn"
          onClick={() => signOut()}
        >
          {t("auth.signOut")}
        </button>
      </div>
    );
  }

  return (
    <div className="auth-bar">
      <button
        type="button"
        className="auth-bar__btn auth-bar__btn--primary"
        onClick={handleSignIn}
        aria-label={t("auth.signInAria")}
      >
        {t("auth.signIn")}
      </button>
      {lastError ? (
        <span className="auth-bar__error" role="alert">
          {t("auth.errorGeneric")}
        </span>
      ) : null}
    </div>
  );
}
