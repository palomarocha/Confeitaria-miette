const mysqlUrl = process.env.MYSQL_URL ?? process.env.DATABASE_URL ?? (() => {
  const host = process.env.MYSQLHOST;
  const port = process.env.MYSQLPORT ?? "3306";
  const user = process.env.MYSQLUSER;
  const password = process.env.MYSQLPASSWORD;
  const database = process.env.MYSQLDATABASE;

  if (!host || !user || !database) return "";
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password ?? "")}@${host}:${port}/${database}`;
})();

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: mysqlUrl,
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
