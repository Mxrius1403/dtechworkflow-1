const fs = require("fs");
const path = require("path");
require("dotenv").config();

const apiOrigin = process.env.API_ORIGIN?.trim().replace(/\/+$/, "");
const isNetlifyBuild = process.env.NETLIFY === "true";

if (isNetlifyBuild && !apiOrigin) {
  throw new Error("Set API_ORIGIN to the public backend origin in Netlify.");
}

let redirects = [];

if (apiOrigin) {
  const url = new URL(apiOrigin);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("API_ORIGIN must be an HTTP(S) origin without a path or credentials.");
  }

  if (isNetlifyBuild && url.protocol !== "https:") {
    throw new Error("API_ORIGIN must use HTTPS for Netlify deployments.");
  }

  redirects.push(
    `/api ${url.origin}/api 200`,
    `/api/* ${url.origin}/api/:splat 200`,
  );
}

redirects.push("/* /index.html 200");

const redirectsPath = path.join(__dirname, "..", "build", "_redirects");
fs.writeFileSync(redirectsPath, `${redirects.join("\n")}\n`);
