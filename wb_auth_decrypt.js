// wb_auth_decrypt.js — 在 WorkBuddy 自带 Electron 二进制（ELECTRON_RUN_AS_NODE=1）下运行。
// 用途：读取 workbuddy-desktop.info 中被 $wbEncrypted(sym-v1) 加密的字段并输出明文。
// 用法: Electron wb_auth_decrypt.js <auth_file> <field_path逗号分隔，如 auth.accessToken>
// 安全约定：
//   - 绝不打印密钥载荷 / 派生密钥 / envelope 细节；stdout 只输出解密后的字段值（供父进程管道捕获）
//   - 失败信息只写 stderr，且不含任何密文/密钥材料
"use strict";
const fs = require("fs");
const crypto = require("crypto");

function fail(msg) {
  process.stderr.write("wb_auth_decrypt: " + msg + "\n");
  process.exit(1);
}

// ---- AAD 构造（对应 at-rest-crypto buildAuthenticatedContextAad, sym-v1）----
function encodeUint32(v) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(v);
  return b;
}
function encodeLengthPrefixed(s) {
  const b = Buffer.from(s, "utf8");
  return Buffer.concat([encodeUint32(b.length), b]);
}
function buildFieldAad(keyId, suite) {
  return Buffer.concat([
    Buffer.from("WB-AAD\0", "ascii"),
    Buffer.from([1]),                    // aad version
    encodeLengthPrefixed("WBEV1"),       // framing magic: field
    encodeLengthPrefixed("sym-v1"),      // scheme
    encodeUint32(suite),                 // suite (from envelope)
    encodeLengthPrefixed(keyId),         // 16-hex key id
    Buffer.from([2]),                    // framing enum: field
    Buffer.from([0]),                    // optional sequence: absent
    Buffer.from([0]),                    // optional final: absent
  ]);
}

function deriveKey(atRestSecretKey) {
  const key = crypto.createHash("sha256").update(atRestSecretKey, "utf8").digest();
  const keyId = crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
  return { key, keyId };
}

function openFieldEnvelope(wrapper, key, keyId) {
  if (!wrapper || wrapper.$wbEncrypted !== 1 || typeof wrapper.envelope !== "string") {
    fail("field is not a standard $wbEncrypted wrapper");
  }
  if (wrapper.scheme) {
    fail("asymmetric (asym-v1) field wrapper is not supported by this helper");
  }
  const env = JSON.parse(Buffer.from(wrapper.envelope, "base64").toString("utf8"));
  if (env.keyId !== keyId) fail("envelope keyId mismatch (wrong build key?)");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(env.nonce, "base64"), { authTagLength: 16 });
  decipher.setAAD(buildFieldAad(env.keyId, env.suite));
  decipher.setAuthTag(Buffer.from(env.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(env.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

function main() {
  const [authPath, fieldPath] = process.argv.slice(2);
  if (!authPath || !fieldPath) fail("usage: wb_auth_decrypt.js <auth_file> <dot.path>");

  let payloadRaw;
  try {
    payloadRaw = process._linkedBinding("electron_browser_workbuddy_storage").loggerGet();
  } catch (e) {
    fail("native workbuddyStorage binding unavailable: " + (e && e.message ? e.message : String(e)));
  }
  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    fail("key payload is not valid JSON");
  }
  if (!payload || typeof payload.atRestSecretKey !== "string") fail("key payload missing atRestSecretKey");
  const { key, keyId } = deriveKey(payload.atRestSecretKey);

  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(authPath, "utf8"));
  } catch (e) {
    fail("cannot read auth file: " + (e && e.message ? e.message : String(e)));
  }
  let node = doc;
  for (const part of fieldPath.split(".")) {
    if (node && typeof node === "object" && part in node) node = node[part];
    else fail("field not found: " + fieldPath);
  }
  if (typeof node === "string") {
    process.stdout.write(node); // 未加密的旧格式，直接透传
    return;
  }
  const plain = openFieldEnvelope(node, key, keyId);
  key.fill(0);
  process.stdout.write(plain);
}

main();
