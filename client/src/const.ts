// Local authentication for the production app. The browser talks directly to
// our own Express server; no Manus OAuth redirect is required.
export const startLogin = async () => {
  const email = window.prompt("E-mail");
  if (!email) return;
  const password = window.prompt("Senha");
  if (!password) return;

  const login = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (login.ok) {
    window.location.reload();
    return;
  }

  if (login.status === 401) {
    const createAccount = window.confirm("Essa conta não existe ou a senha está incorreta. Deseja criar uma conta?");
    if (!createAccount) return;
    const name = window.prompt("Seu nome");
    if (!name) return;
    const register = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, email, password }),
    });
    if (register.ok) {
      window.location.reload();
      return;
    }
    const data = await register.json().catch(() => ({}));
    window.alert(data.error || "Não foi possível criar sua conta.");
    return;
  }

  const data = await login.json().catch(() => ({}));
  window.alert(data.error || "Não foi possível entrar.");
};
